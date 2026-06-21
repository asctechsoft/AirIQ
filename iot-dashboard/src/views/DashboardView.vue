<template>
  <div class="app-shell">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-icon">🌬️</span>
        <span class="brand-name">AirWatch</span>
      </div>

      <nav class="nav">
        <a
          v-for="item in navItems"
          :key="item.id"
          class="nav-item"
          :class="{ active: activeTab === item.id }"
          @click="activeTab = item.id"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
        </a>
      </nav>

      <div class="sidebar-footer">
        <div class="device-status">
          <span class="status-dot" :class="isOnline ? 'online' : 'offline'"></span>
          <span class="status-text">{{ isOnline ? 'esp32-room1' : 'Offline' }}</span>
        </div>
        <button class="logout-btn" @click="logout">⎋ Đăng xuất</button>
      </div>
    </aside>

    <!-- Main content -->
    <main class="main">
      <!-- Header -->
      <header class="topbar">
        <div class="topbar-left">
          <h1 class="page-title">{{ currentPage.label }}</h1>
          <span class="last-update">Cập nhật: {{ lastUpdate }}</span>
        </div>
        <div class="topbar-right">
          <div class="air-index" :class="airQualityClass">
            {{ airQualityLabel }}
          </div>
        </div>
      </header>

      <!-- TAB: Dashboard -->
      <div v-if="activeTab === 'dashboard'" class="tab-content">
        <!-- Metric cards -->
        <div class="metrics">
          <div class="metric-card" :class="{ danger: latest.temperature > 35 }">
            <div class="metric-top">
              <span class="metric-label">Nhiệt độ</span>
              <span class="metric-icon">🌡️</span>
            </div>
            <div class="metric-value">{{ latest.temperature ?? '--' }}<span class="metric-unit">°C</span></div>
            <div class="metric-bar">
              <div class="metric-fill temp" :style="{ width: tempPct + '%' }"></div>
            </div>
            <div class="metric-hint" :class="latest.temperature > 35 ? 'warn' : 'ok'">
              {{ latest.temperature > 35 ? '⚠ Quá nóng' : '✓ Bình thường' }}
            </div>
          </div>

          <div class="metric-card" :class="{ warning: latest.humidity < 30 || latest.humidity > 70 }">
            <div class="metric-top">
              <span class="metric-label">Độ ẩm</span>
              <span class="metric-icon">💧</span>
            </div>
            <div class="metric-value">{{ latest.humidity ?? '--' }}<span class="metric-unit">%</span></div>
            <div class="metric-bar">
              <div class="metric-fill hum" :style="{ width: (latest.humidity ?? 0) + '%' }"></div>
            </div>
            <div class="metric-hint" :class="(latest.humidity < 30 || latest.humidity > 70) ? 'warn' : 'ok'">
              {{ latest.humidity < 30 ? '⚠ Quá khô' : latest.humidity > 70 ? '⚠ Quá ẩm' : '✓ Bình thường' }}
            </div>
          </div>

          <div class="metric-card" :class="{ danger: latest.co2 > 1000, warning: latest.co2 > 800 && latest.co2 <= 1000 }">
            <div class="metric-top">
              <span class="metric-label">CO₂</span>
              <span class="metric-icon">💨</span>
            </div>
            <div class="metric-value">{{ latest.co2 ?? '--' }}<span class="metric-unit">ppm</span></div>
            <div class="metric-bar">
              <div class="metric-fill co2" :style="{ width: co2Pct + '%' }"></div>
            </div>
            <div class="metric-hint" :class="latest.co2 > 1000 ? 'warn' : latest.co2 > 800 ? 'warn' : 'ok'">
              {{ latest.co2 > 1000 ? '⚠ Nguy hiểm' : latest.co2 > 800 ? '⚠ CO₂ cao' : '✓ An toàn' }}
            </div>
          </div>

          <div class="metric-card info">
            <div class="metric-top">
              <span class="metric-label">Thiết bị</span>
              <span class="metric-icon">📡</span>
            </div>
            <div class="metric-value device-id">{{ latest.deviceId ?? '--' }}</div>
            <div class="metric-bar">
              <div class="metric-fill info-fill" style="width: 100%"></div>
            </div>
            <div class="metric-hint ok">{{ formatTime(latest.timestamp) }}</div>
          </div>
        </div>

        <!-- Chart -->
        <div class="chart-card">
          <div class="chart-header">
            <span class="chart-title">📊 Lịch sử theo thời gian</span>
            <span class="chart-count">{{ history.length }} điểm dữ liệu</span>
          </div>
          <div class="chart-wrap">
            <Line v-if="chartData.labels.length" :data="chartData" :options="chartOptions" />
            <div v-else class="no-data">Đang tải dữ liệu...</div>
          </div>
        </div>
      </div>

      <!-- TAB: Alerts -->
      <div v-if="activeTab === 'alerts'" class="tab-content">
        <div class="alerts-wrap">
          <div v-if="alerts.length === 0" class="empty-state">
            <span>✅</span>
            <p>Không có cảnh báo nào</p>
          </div>
          <div v-for="(a, i) in alerts" :key="i" class="alert-row">
            <span class="alert-badge">⚠</span>
            <span class="alert-msg">{{ a }}</span>
          </div>
        </div>
      </div>

      <!-- TAB: Devices -->
      <div v-if="activeTab === 'devices'" class="tab-content">
        <div class="device-card">
          <div class="device-header">
            <span class="status-dot online"></span>
            <span class="device-name">esp32-room1</span>
          </div>
          <div class="device-info-grid">
            <div class="device-info-item">
              <span class="di-label">Giao thức</span>
              <span class="di-value">MQTT / TLS</span>
            </div>
            <div class="device-info-item">
              <span class="di-label">Broker</span>
              <span class="di-value">HiveMQ Cloud</span>
            </div>
            <div class="device-info-item">
              <span class="di-label">Topic</span>
              <span class="di-value">iot/airquality/room1</span>
            </div>
            <div class="device-info-item">
              <span class="di-label">Cảm biến</span>
              <span class="di-value">DHT22 + MQ135</span>
            </div>
            <div class="device-info-item">
              <span class="di-label">Chu kỳ gửi</span>
              <span class="di-value">5 giây</span>
            </div>
            <div class="device-info-item">
              <span class="di-label">Cập nhật lần cuối</span>
              <span class="di-value">{{ formatTime(latest.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>

    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Legend
} from 'chart.js'
import api from '../services/api'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const router = useRouter()
const activeTab = ref('dashboard')
const latest = ref({})
const history = ref([])
const alerts = ref([])
const lastUpdate = ref('--')

const navItems = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'alerts',    icon: '🚨', label: 'Cảnh báo' },
  { id: 'devices',   icon: '📡', label: 'Thiết bị' },
]

const currentPage = computed(() => navItems.find(n => n.id === activeTab.value) || navItems[0])
const isOnline = computed(() => !!latest.value.timestamp)

const tempPct = computed(() => Math.min(((latest.value.temperature ?? 0) / 50) * 100, 100))
const co2Pct  = computed(() => Math.min(((latest.value.co2 ?? 0) / 2000) * 100, 100))

const airQualityClass = computed(() => {
  if (!latest.value.co2) return 'aqi-good'
  if (latest.value.co2 > 1000) return 'aqi-danger'
  if (latest.value.co2 > 800)  return 'aqi-warn'
  return 'aqi-good'
})

const airQualityLabel = computed(() => {
  if (!latest.value.co2) return '— Chưa có dữ liệu'
  if (latest.value.co2 > 1000) return '🔴 Không khí nguy hiểm'
  if (latest.value.co2 > 800)  return '🟡 Không khí kém'
  return '🟢 Không khí tốt'
})

const formatTime = (ts) => ts ? new Date(ts).toLocaleTimeString('vi-VN') : '--'

const chartData = computed(() => ({
  labels: history.value.map(d => formatTime(d.timestamp)),
  datasets: [
    {
      label: 'Nhiệt độ (°C)',
      data: history.value.map(d => d.temperature),
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239,68,68,0.08)',
      tension: 0.4, pointRadius: 2, borderWidth: 2,
    },
    {
      label: 'Độ ẩm (%)',
      data: history.value.map(d => d.humidity),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.08)',
      tension: 0.4, pointRadius: 2, borderWidth: 2,
    },
    {
      label: 'CO₂ (÷10)',
      data: history.value.map(d => +(d.co2 / 10).toFixed(1)),
      borderColor: '#10b981',
      backgroundColor: 'rgba(16,185,129,0.08)',
      tension: 0.4, pointRadius: 2, borderWidth: 2,
    },
  ]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } }
  },
  scales: {
    x: { ticks: { maxTicksLimit: 10, font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
    y: { ticks: { font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.04)' } }
  }
}

const fetchData = async () => {
  try {
    const [latestRes, histRes] = await Promise.all([
      api.get('/sensor/latest'),
      api.get('/sensor/data')
    ])
    latest.value  = latestRes.data || {}
    history.value = (histRes.data || []).reverse().slice(-50)
    lastUpdate.value = formatTime(new Date())

    if (latest.value.co2 > 1000) {
      const msg = `[${formatTime(latest.value.timestamp)}] CO₂ = ${latest.value.co2}ppm — Nguy hiểm!`
      if (!alerts.value.includes(msg)) alerts.value.unshift(msg)
    }
  } catch (err) {
    console.error(err)
  }
}

const logout = () => { localStorage.removeItem('token'); router.push('/login') }

let interval
onMounted(() => { fetchData(); interval = setInterval(fetchData, 5000) })
onUnmounted(() => clearInterval(interval))
</script>

<style scoped>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.app-shell {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: #f1f5f9;
  font-family: 'Inter', 'Segoe UI', sans-serif;
}

/* ── Sidebar ── */
.sidebar {
  width: 200px;
  min-width: 200px;
  background: #0f172a;
  display: flex;
  flex-direction: column;
  padding: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 16px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.brand-icon { font-size: 22px; }
.brand-name { color: white; font-weight: 700; font-size: 16px; letter-spacing: -0.3px; }

.nav { flex: 1; padding: 12px 8px; display: flex; flex-direction: column; gap: 4px; }
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  color: rgba(255,255,255,0.5);
  font-size: 13px;
}
.nav-item:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8); }
.nav-item.active { background: #1e40af; color: white; }
.nav-icon { font-size: 15px; }
.nav-label { font-weight: 500; }

.sidebar-footer {
  padding: 12px 8px;
  border-top: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.device-status { display: flex; align-items: center; gap: 8px; padding: 0 8px; }
.status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.status-dot.online  { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
.status-dot.offline { background: #ef4444; }
.status-text { color: rgba(255,255,255,0.5); font-size: 11px; }

.logout-btn {
  margin: 0 4px;
  padding: 8px 12px;
  background: rgba(239,68,68,0.12);
  color: #f87171;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}
.logout-btn:hover { background: rgba(239,68,68,0.22); }

/* ── Main ── */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}
.page-title { font-size: 16px; font-weight: 700; color: #0f172a; }
.last-update { font-size: 11px; color: #94a3b8; margin-left: 10px; }

.air-index {
  padding: 5px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}
.aqi-good   { background: #dcfce7; color: #15803d; }
.aqi-warn   { background: #fef9c3; color: #a16207; }
.aqi-danger { background: #fee2e2; color: #b91c1c; }

/* ── Tab content ── */
.tab-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
  gap: 14px;
  min-height: 0;
  max-height: calc(100vh - 60px);
}

/* ── Metrics ── */
.metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  flex-shrink: 0;
}

.metric-card {
  background: white;
  border-radius: 12px;
  padding: 14px 16px;
  border-left: 3px solid #3b82f6;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.metric-card.danger  { border-left-color: #ef4444; }
.metric-card.warning { border-left-color: #f59e0b; }
.metric-card.info    { border-left-color: #8b5cf6; }

.metric-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.metric-label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
.metric-icon { font-size: 18px; }

.metric-value { font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1; margin-bottom: 8px; }
.metric-value.device-id { font-size: 14px; font-weight: 600; padding-top: 6px; }
.metric-unit { font-size: 13px; font-weight: 500; color: #94a3b8; margin-left: 2px; }

.metric-bar { height: 4px; background: #f1f5f9; border-radius: 2px; overflow: hidden; margin-bottom: 6px; }
.metric-fill { height: 100%; border-radius: 2px; transition: width 0.5s ease; }
.metric-fill.temp      { background: #ef4444; }
.metric-fill.hum       { background: #3b82f6; }
.metric-fill.co2       { background: #10b981; }
.metric-fill.info-fill { background: #8b5cf6; }

.metric-hint { font-size: 11px; font-weight: 500; }
.metric-hint.ok   { color: #22c55e; }
.metric-hint.warn { color: #f59e0b; }

/* ── Chart ── */
.chart-card {
  background: white;
  border-radius: 12px;
  padding: 14px 16px;
  height: 550px;
  max-height: 550px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-shrink: 0; }
.chart-title { font-size: 13px; font-weight: 600; color: #0f172a; }
.chart-count { font-size: 11px; color: #94a3b8; }
.chart-wrap { flex: 1; min-height: 0; position: relative; }
.no-data { display: flex; align-items: center; justify-content: center; height: 100%; color: #94a3b8; font-size: 13px; }

/* ── Alerts ── */
.alerts-wrap { display: flex; flex-direction: column; gap: 8px; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px; color: #94a3b8; font-size: 13px; }
.empty-state span { font-size: 32px; }
.alert-row { display: flex; align-items: center; gap: 10px; background: white; padding: 12px 16px; border-radius: 10px; border-left: 3px solid #f59e0b; }
.alert-badge { font-size: 16px; }
.alert-msg { font-size: 13px; color: #374151; }

/* ── Devices ── */
.device-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); max-width: 500px; }
.device-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.device-name { font-size: 15px; font-weight: 700; color: #0f172a; }
.device-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.device-info-item { display: flex; flex-direction: column; gap: 3px; }
.di-label { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; }
.di-value { font-size: 13px; font-weight: 500; color: #0f172a; }
</style>