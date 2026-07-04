<template>
  <div class="app-shell">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-icon">🌬️</span>
        <span class="brand-name">AirIQ</span>
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
          <span v-if="item.id === 'alerts' && unresolvedCount > 0" class="nav-badge">
            {{ unresolvedCount }}
          </span>
        </a>
      </nav>

      <div class="sidebar-footer">
        <div class="device-status">
          <span class="status-dot" :class="isOnline ? 'online' : 'offline'"></span>
          <span class="status-text">{{ latest.deviceId || 'Offline' }}</span>
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
          <div class="air-index" :class="airQualityClass">{{ airQualityLabel }}</div>
        </div>
      </header>

      <!-- TAB: Dashboard -->
      <div v-if="activeTab === 'dashboard'" class="tab-content">
        <div class="metrics">
          <MetricGaugeCard
            label="Nhiệt độ"
            icon="🌡️"
            :value="latest.temperature ?? '--'"
            unit="°C"
            :pct="tempPct"
            :color="tempColor"
            :ok="tempStatus !== 'danger'"
            :hint="tempStatus === 'danger' ? '⚠ Quá nóng' : '✓ Bình thường'"
            :sparkline-points="tempSparkline"
          />

          <MetricGaugeCard
            label="Độ ẩm"
            icon="💧"
            :value="latest.humidity ?? '--'"
            unit="%"
            :pct="latest.humidity ?? 0"
            :color="humidityColor"
            :ok="humidityStatus !== 'warning'"
            :hint="humidityStatus === 'warning'
              ? (latest.humidity < settings.humidity_min ? '⚠ Quá khô' : '⚠ Quá ẩm')
              : '✓ Bình thường'"
            :sparkline-points="humiditySparkline"
          />

          <MetricGaugeCard
            label="CO₂"
            icon="💨"
            :value="latest.co2 ?? '--'"
            unit="ppm"
            :pct="co2Pct"
            :color="co2Color"
            :ok="co2Status === 'normal'"
            :hint="co2Status === 'danger' ? '⚠ Nguy hiểm' : co2Status === 'warning' ? '⚠ CO₂ cao' : '✓ An toàn'"
            :sparkline-points="co2Sparkline"
          />

          <div class="metric-card info">
            <div class="metric-top">
              <span class="metric-label">Thiết bị</span>
              <span class="metric-icon">📡</span>
            </div>
            <div class="metric-value device-id">{{ latest.deviceId ?? '--' }}</div>
            <div class="metric-bar">
              <div class="metric-fill info-fill" style="width:100%"></div>
            </div>
            <div class="metric-hint ok">{{ formatTime(latest.timestamp) }}</div>
          </div>
        </div>

        <div class="mini-charts-header">
          <span class="chart-title"><span class="live-dot"></span>📊 Theo dõi thời gian thực</span>
          <span class="chart-count">{{ history.length }} điểm dữ liệu</span>
        </div>
        <div class="mini-charts">
          <div class="chart-card mini">
            <div class="chart-header"><span class="chart-title-sm">🌡️ Nhiệt độ (°C)</span></div>
            <div class="chart-wrap">
              <Line v-if="history.length" :data="tempChartData" :options="miniChartOptions" />
              <div v-else class="no-data">Đang tải...</div>
            </div>
            <div v-if="tempWindowStats" class="mini-stats">
              Min {{ tempWindowStats.min }} · Max {{ tempWindowStats.max }} · TB {{ tempWindowStats.avg }}
            </div>
          </div>

          <div class="chart-card mini">
            <div class="chart-header"><span class="chart-title-sm">💧 Độ ẩm (%)</span></div>
            <div class="chart-wrap">
              <Line v-if="history.length" :data="humidityChartData" :options="miniChartOptions" />
              <div v-else class="no-data">Đang tải...</div>
            </div>
            <div v-if="humidityWindowStats" class="mini-stats">
              Min {{ humidityWindowStats.min }} · Max {{ humidityWindowStats.max }} · TB {{ humidityWindowStats.avg }}
            </div>
          </div>

          <div class="chart-card mini">
            <div class="chart-header"><span class="chart-title-sm">💨 CO₂ (ppm)</span></div>
            <div class="chart-wrap">
              <Line v-if="history.length" :data="co2ChartData" :options="miniChartOptions" />
              <div v-else class="no-data">Đang tải...</div>
            </div>
            <div v-if="co2WindowStats" class="mini-stats">
              Min {{ co2WindowStats.min }} · Max {{ co2WindowStats.max }} · TB {{ co2WindowStats.avg }}
            </div>
          </div>
        </div>

        <div class="chart-card weekly-card">
          <div class="chart-header">
            <span class="chart-title-sm">📅 Cảnh báo theo ngày (7 ngày qua)</span>
          </div>
          <div class="chart-wrap">
            <Bar v-if="weeklyAlertData.labels.length" :data="weeklyAlertData" :options="weeklyAlertOptions" />
            <div v-else class="no-data">Đang tải...</div>
          </div>
        </div>
      </div>

      <!-- TAB: History -->
      <div v-if="activeTab === 'history'" class="tab-content history-tab">
        <div class="hist-toolbar">
          <div class="date-range">
            <div class="date-input">
              <label>Từ ngày</label>
              <input type="datetime-local" v-model="histFrom" />
            </div>
            <div class="date-input">
              <label>Đến ngày</label>
              <input type="datetime-local" v-model="histTo" />
            </div>
          </div>
          <div class="hist-actions">
            <button class="btn-primary" @click="fetchHistory" :disabled="histLoading">
              {{ histLoading ? '...' : '🔍 Tìm kiếm' }}
            </button>
            <button class="btn-export" @click="exportCSV" :disabled="histData.length === 0">
              📥 Xuất CSV
            </button>
          </div>
        </div>

        <p v-if="histError" class="hist-error">⚠ {{ histError }}</p>

        <div v-if="histData.length > 0" class="hist-stats">
          <span class="stat-chip">{{ histData.length }} bản ghi</span>
        </div>

        <div v-if="histLoading" class="chart-card chart-grow">
          <div class="no-data">Đang tải...</div>
        </div>
        <div v-else-if="histData.length === 0" class="chart-card chart-grow">
          <div class="no-data">Chọn khoảng thời gian và nhấn Tìm kiếm</div>
        </div>
        <div v-else class="mini-charts hist-mini-charts">
          <div class="chart-card mini hist-mini">
            <div class="chart-header"><span class="chart-title-sm">🌡️ Nhiệt độ (°C)</span></div>
            <div class="chart-wrap">
              <Line :data="histTempChartData" :options="miniChartOptions" />
            </div>
            <div v-if="histTempStats" class="mini-stats">
              Min {{ histTempStats.min }} · Max {{ histTempStats.max }} · TB {{ histTempStats.avg }}
            </div>
          </div>

          <div class="chart-card mini hist-mini">
            <div class="chart-header"><span class="chart-title-sm">💧 Độ ẩm (%)</span></div>
            <div class="chart-wrap">
              <Line :data="histHumidityChartData" :options="miniChartOptions" />
            </div>
            <div v-if="histHumidityStats" class="mini-stats">
              Min {{ histHumidityStats.min }} · Max {{ histHumidityStats.max }} · TB {{ histHumidityStats.avg }}
            </div>
          </div>

          <div class="chart-card mini hist-mini">
            <div class="chart-header"><span class="chart-title-sm">💨 CO₂ (ppm)</span></div>
            <div class="chart-wrap">
              <Line :data="histCo2ChartData" :options="miniChartOptions" />
            </div>
            <div v-if="histCo2Stats" class="mini-stats">
              Min {{ histCo2Stats.min }} · Max {{ histCo2Stats.max }} · TB {{ histCo2Stats.avg }}
            </div>
          </div>
        </div>
      </div>

      <!-- TAB: Alerts -->
      <div v-if="activeTab === 'alerts'" class="tab-content">
        <div class="alert-stats-row">
          <div class="stat-card">
            <span class="stat-card-value">{{ alertStats.total }}</span>
            <span class="stat-card-label">Tổng cảnh báo</span>
          </div>
          <div class="stat-card" :class="{ warn: alertStats.unresolved > 0 }">
            <span class="stat-card-value">{{ alertStats.unresolved }}</span>
            <span class="stat-card-label">Chưa xử lý</span>
          </div>
          <div class="stat-card type-card">
            <span class="stat-card-label">Theo loại</span>
            <div class="type-bar-wrap">
              <Bar v-if="alertStats.total > 0" :data="alertTypeChartData" :options="alertTypeChartOptions" />
              <div v-else class="no-data small">Chưa có dữ liệu</div>
            </div>
          </div>
        </div>

        <div class="alerts-toolbar">
          <div class="filter-tabs">
            <button
              :class="['filter-btn', alertFilter === 'unresolved' ? 'active' : '']"
              @click="setAlertFilter('unresolved')"
            >
              Chưa xử lý
              <span v-if="unresolvedCount > 0" class="badge">{{ unresolvedCount }}</span>
            </button>
            <button
              :class="['filter-btn', alertFilter === 'all' ? 'active' : '']"
              @click="setAlertFilter('all')"
            >Tất cả</button>
          </div>
          <div class="toolbar-actions">
            <button class="btn-ghost" @click="fetchAlerts(); fetchAlertStats()">🔄 Làm mới</button>
            <button class="btn-ghost btn-danger" @click="deleteAllAlerts" :disabled="alertsData.length === 0">
              🗑 Xóa tất cả
            </button>
          </div>
        </div>

        <div v-if="alertsLoading" class="empty-state"><p>Đang tải...</p></div>
        <div v-else-if="alertsData.length === 0" class="empty-state">
          <span>✅</span><p>Không có cảnh báo nào</p>
        </div>
        <div v-else class="alerts-list">
          <div
            v-for="a in alertsData"
            :key="a._id"
            class="alert-row"
            :class="[`alert-${a.type}`, { resolved: a.resolved }]"
          >
            <div class="alert-icon">{{ alertTypeIcon(a.type) }}</div>
            <div class="alert-body">
              <div class="alert-msg">{{ a.message }}</div>
              <div class="alert-meta">{{ a.deviceId }} · {{ formatDateTime(a.createdAt) }}</div>
            </div>
            <div class="alert-actions">
              <button v-if="!a.resolved" class="btn-resolve" @click="resolveAlert(a._id)">✓</button>
              <button class="btn-del" @click="deleteAlert(a._id)">🗑</button>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB: Devices -->
      <div v-if="activeTab === 'devices'" class="tab-content">
        <div class="device-card">
          <div class="device-header">
            <span class="status-dot" :class="isOnline ? 'online' : 'offline'"></span>
            <span class="device-name">{{ latest.deviceId || 'Chưa kết nối' }}</span>
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
              <span class="di-value">iot/airquality/#</span>
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

      <!-- TAB: Settings -->
      <div v-if="activeTab === 'settings'" class="tab-content">
        <div class="settings-card">
          <h2 class="settings-title">⚙️ Ngưỡng cảnh báo</h2>
          <p class="settings-desc">Cảnh báo sẽ được tạo tự động khi giá trị vượt ngưỡng.</p>

          <div class="settings-grid">
            <div class="setting-item">
              <label>🌡️ Nhiệt độ tối đa (°C)</label>
              <input type="number" v-model.number="settings.temp_max" min="0" max="100" />
            </div>
            <div class="setting-item">
              <label>💧 Độ ẩm tối thiểu (%)</label>
              <input type="number" v-model.number="settings.humidity_min" min="0" max="100" />
            </div>
            <div class="setting-item">
              <label>💧 Độ ẩm tối đa (%)</label>
              <input type="number" v-model.number="settings.humidity_max" min="0" max="100" />
            </div>
            <div class="setting-item">
              <label>💨 CO₂ cảnh báo (ppm)</label>
              <input type="number" v-model.number="settings.co2_warn" min="0" max="5000" />
            </div>
            <div class="setting-item">
              <label>💨 CO₂ nguy hiểm (ppm)</label>
              <input type="number" v-model.number="settings.co2_danger" min="0" max="5000" />
            </div>
          </div>

          <div class="settings-footer">
            <button class="btn-save" :class="{ saved: settingsSaved }" @click="saveSettings">
              {{ settingsSaved ? '✓ Đã lưu!' : '💾 Lưu cài đặt' }}
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Line, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, BarElement, Filler, Title, Tooltip, Legend
} from 'chart.js'
import api from '../services/api'
import MetricGaugeCard from '../components/MetricGaugeCard.vue'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Title, Tooltip, Legend)

const router = useRouter()
const activeTab = ref('dashboard')
const latest = ref({})
const history = ref([])
const lastUpdate = ref('--')
const weeklyAlerts = ref([])

// Alerts
const alertsData = ref([])
const alertFilter = ref('unresolved')
const alertsLoading = ref(false)
const alertStats = ref({ total: 0, unresolved: 0, byType: { co2: 0, temperature: 0, humidity: 0 } })

// History
const histFrom = ref('')
const histTo = ref('')
const histData = ref([])
const histLoading = ref(false)
const histError = ref('')

// Settings
const settings = ref({ temp_max: 35, humidity_min: 30, humidity_max: 70, co2_warn: 800, co2_danger: 1000 })
const settingsSaved = ref(false)

const navItems = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'history',   icon: '📅', label: 'Lịch sử' },
  { id: 'alerts',    icon: '🚨', label: 'Cảnh báo' },
  { id: 'devices',   icon: '📡', label: 'Thiết bị' },
  { id: 'settings',  icon: '⚙️',  label: 'Cài đặt' },
]

const currentPage = computed(() => navItems.find(n => n.id === activeTab.value) || navItems[0])
const isOnline     = computed(() => !!latest.value.timestamp)
// Lấy từ /alerts/stats (poll cùng nhịp fetchLive) thay vì đếm trên alertsData —
// alertsData chỉ mới khi đang mở tab Cảnh báo, còn badge sidebar cần luôn mới.
const unresolvedCount = computed(() => alertStats.value.unresolved)

const tempStatus = computed(() => {
  if (!latest.value.temperature) return 'normal'
  return latest.value.temperature >= settings.value.temp_max ? 'danger' : 'normal'
})
const humidityStatus = computed(() => {
  const h = latest.value.humidity
  if (!h) return 'normal'
  return (h < settings.value.humidity_min || h > settings.value.humidity_max) ? 'warning' : 'normal'
})
const co2Status = computed(() => {
  const c = latest.value.co2
  if (!c) return 'normal'
  if (c >= settings.value.co2_danger) return 'danger'
  if (c >= settings.value.co2_warn)   return 'warning'
  return 'normal'
})

const tempPct = computed(() => Math.min(((latest.value.temperature ?? 0) / 50) * 100, 100))
const co2Pct  = computed(() => Math.min(((latest.value.co2 ?? 0) / 2000) * 100, 100))

// ── Màu gauge theo mức độ (good/warning/critical) ──────
const STATUS_COLORS = { normal: '#0ca30c', warning: '#fab219', danger: '#d03b3b' }
const tempColor     = computed(() => STATUS_COLORS[tempStatus.value])
const humidityColor = computed(() => STATUS_COLORS[humidityStatus.value])
const co2Color      = computed(() => STATUS_COLORS[co2Status.value])

// ── Sparkline xu hướng (dùng cùng thang % với gauge) ───
const buildSparkline = (key, toPct) => {
  const points = history.value.slice(-20).filter(d => d[key] != null)
  if (points.length < 2) return ''
  const w = 100, h = 28
  return points
    .map((d, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - (Math.min(Math.max(toPct(d[key]), 0), 100) / 100) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
const tempSparkline     = computed(() => buildSparkline('temperature', v => (v / 50) * 100))
const humiditySparkline = computed(() => buildSparkline('humidity', v => v))
const co2Sparkline      = computed(() => buildSparkline('co2', v => (v / 2000) * 100))

const airQualityClass = computed(() => {
  if (co2Status.value === 'danger' || tempStatus.value === 'danger') return 'aqi-danger'
  if (co2Status.value === 'warning' || humidityStatus.value === 'warning') return 'aqi-warn'
  return 'aqi-good'
})
const airQualityLabel = computed(() => {
  if (!latest.value.co2) return '— Chưa có dữ liệu'
  if (airQualityClass.value === 'aqi-danger') return '🔴 Không khí nguy hiểm'
  if (airQualityClass.value === 'aqi-warn')   return '🟡 Không khí kém'
  return '🟢 Không khí tốt'
})

const formatTime     = (ts) => ts ? new Date(ts).toLocaleTimeString('vi-VN') : '--'
const formatDateTime = (ts) => ts ? new Date(ts).toLocaleString('vi-VN') : '--'
const alertTypeIcon  = (type) => ({ co2: '💨', temperature: '🌡️', humidity: '💧' }[type] || '⚠️')

// toISOString() trả về giờ UTC — gán thẳng vào <input type="datetime-local">
// sẽ bị lệch theo múi giờ của trình duyệt vì input đó hiểu chuỗi là giờ địa
// phương. Format thủ công theo giờ local để mặc định "24h gần nhất" đúng thật.
const toLocalInputValue = (date) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ── Mini chart riêng cho từng đại lượng (mỗi đại lượng 1 trục) ──
// Gộp chung 1 trục sẽ làm nhiệt độ/độ ẩm trông phẳng lì cạnh CO2 (khác đơn vị,
// khác biên độ) nên tách nhỏ mỗi cái 1 chart, tự scale theo dữ liệu của nó.
// Dùng chung cho cả Dashboard (history, 20 điểm gần nhất) và Lịch sử (histData,
// khoảng thời gian tùy chọn).
const miniChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { maxTicksLimit: 6, font: { size: 9 } }, grid: { display: false } },
    y: { ticks: { font: { size: 9 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
  },
}

const buildMiniChart = (source, key, color, bg, labelFn = formatTime) => computed(() => ({
  labels: source.value.map(d => labelFn(d.timestamp)),
  datasets: [{
    data: source.value.map(d => d[key]),
    borderColor: color, backgroundColor: bg,
    fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2,
  }],
}))

const tempChartData     = buildMiniChart(history, 'temperature', '#ef4444', 'rgba(239,68,68,0.10)')
const humidityChartData = buildMiniChart(history, 'humidity', '#3b82f6', 'rgba(59,130,246,0.10)')
const co2ChartData      = buildMiniChart(history, 'co2', '#10b981', 'rgba(16,185,129,0.10)')

const histTempChartData     = buildMiniChart(histData, 'temperature', '#ef4444', 'rgba(239,68,68,0.10)', formatDateTime)
const histHumidityChartData = buildMiniChart(histData, 'humidity', '#3b82f6', 'rgba(59,130,246,0.10)', formatDateTime)
const histCo2ChartData      = buildMiniChart(histData, 'co2', '#10b981', 'rgba(16,185,129,0.10)', formatDateTime)

const computeWindowStats = (values, digits = 1) => {
  const valid = values.filter(v => v != null && !Number.isNaN(v))
  if (!valid.length) return null
  return {
    min: Math.min(...valid).toFixed(digits),
    max: Math.max(...valid).toFixed(digits),
    avg: (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(digits),
  }
}
const tempWindowStats     = computed(() => computeWindowStats(history.value.map(d => d.temperature)))
const humidityWindowStats = computed(() => computeWindowStats(history.value.map(d => d.humidity)))
const co2WindowStats      = computed(() => computeWindowStats(history.value.map(d => d.co2), 0))

const histTempStats     = computed(() => computeWindowStats(histData.value.map(d => d.temperature)))
const histHumidityStats = computed(() => computeWindowStats(histData.value.map(d => d.humidity)))
const histCo2Stats      = computed(() => computeWindowStats(histData.value.map(d => d.co2), 0))

// ── Cảnh báo theo loại — dùng đúng màu identity đã dùng ở list cảnh báo ──
const ALERT_TYPE_COLORS = { co2: '#10b981', temperature: '#ef4444', humidity: '#3b82f6' }
const ALERT_TYPE_LABELS = { co2: 'CO₂', temperature: 'Nhiệt độ', humidity: 'Độ ẩm' }
const ALERT_TYPES = ['co2', 'temperature', 'humidity']

const alertTypeChartData = computed(() => ({
  labels: ALERT_TYPES.map(t => ALERT_TYPE_LABELS[t]),
  datasets: [{
    data: ALERT_TYPES.map(t => alertStats.value.byType[t] || 0),
    backgroundColor: ALERT_TYPES.map(t => ALERT_TYPE_COLORS[t]),
    borderRadius: 6,
    barThickness: 22,
  }],
}))
const alertTypeChartOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
    y: { ticks: { font: { size: 11 } }, grid: { display: false } },
  },
}

// ── Cảnh báo theo ngày trong tuần — cột xếp chồng theo loại ──
const weeklyAlertData = computed(() => ({
  labels: weeklyAlerts.value.map(d => new Date(d.date).toLocaleDateString('vi-VN', { weekday: 'short' })),
  datasets: ALERT_TYPES.map(t => ({
    label: ALERT_TYPE_LABELS[t],
    data: weeklyAlerts.value.map(d => d[t] || 0),
    backgroundColor: ALERT_TYPE_COLORS[t],
    stack: 'alerts',
    borderRadius: 4,
  })),
}))
const weeklyAlertOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
  },
  scales: {
    x: { stacked: true, ticks: { font: { size: 11 } }, grid: { display: false } },
    y: { stacked: true, beginAtZero: true, ticks: { precision: 0, font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
  },
}

// ── API calls ──────────────────────────────────────────

const fetchLive = async () => {
  try {
    const [latestRes, histRes] = await Promise.all([
      api.get('/sensor/latest'),
      api.get('/sensor/data'),
    ])
    latest.value  = latestRes.data || {}
    history.value = (histRes.data || []).reverse().slice(-50)
    lastUpdate.value = formatTime(new Date())
  } catch (err) {
    console.error(err)
  }
}

const fetchWeeklyAlerts = async () => {
  try {
    const res = await api.get('/alerts/weekly')
    weeklyAlerts.value = res.data
  } catch (err) { console.error(err) }
}

const fetchAlerts = async () => {
  alertsLoading.value = true
  try {
    const params = alertFilter.value === 'unresolved' ? { resolved: false } : {}
    const res = await api.get('/alerts', { params })
    alertsData.value = res.data
  } catch (err) {
    console.error(err)
  } finally {
    alertsLoading.value = false
  }
}

const fetchAlertStats = async () => {
  try {
    const res = await api.get('/alerts/stats')
    alertStats.value = res.data
  } catch (err) { console.error(err) }
}

const setAlertFilter = (f) => { alertFilter.value = f }
watch(alertFilter, fetchAlerts)

const resolveAlert = async (id) => {
  try {
    await api.patch(`/alerts/${id}/resolve`)
    if (alertFilter.value === 'unresolved') {
      alertsData.value = alertsData.value.filter(a => a._id !== id)
    } else {
      const idx = alertsData.value.findIndex(a => a._id === id)
      if (idx !== -1) alertsData.value[idx] = { ...alertsData.value[idx], resolved: true }
    }
    fetchAlertStats()
  } catch (err) { console.error(err) }
}

const deleteAlert = async (id) => {
  try {
    await api.delete(`/alerts/${id}`)
    alertsData.value = alertsData.value.filter(a => a._id !== id)
    fetchAlertStats()
    fetchWeeklyAlerts()
  } catch (err) { console.error(err) }
}

const deleteAllAlerts = async () => {
  const scope = alertFilter.value === 'unresolved' ? 'chưa xử lý' : 'tất cả'
  if (!confirm(`Xóa ${scope} cảnh báo (${alertsData.value.length})? Không thể hoàn tác.`)) return
  try {
    const params = alertFilter.value === 'unresolved' ? { resolved: false } : {}
    await api.delete('/alerts', { params })
    alertsData.value = []
    fetchAlertStats()
    fetchWeeklyAlerts()
  } catch (err) { console.error(err) }
}

const fetchHistory = async () => {
  histError.value = ''
  if (histFrom.value && histTo.value && new Date(histFrom.value) > new Date(histTo.value)) {
    histError.value = '"Từ ngày" đang đứng sau "Đến ngày" — đổi lại thứ tự thì mới tìm ra dữ liệu.'
    histData.value = []
    return
  }

  histLoading.value = true
  try {
    const params = {}
    if (histFrom.value) params.from = histFrom.value
    if (histTo.value)   params.to   = histTo.value
    const res = await api.get('/sensor/history', { params })
    histData.value = res.data
  } catch (err) {
    console.error(err)
  } finally {
    histLoading.value = false
  }
}

const exportCSV = async () => {
  if (histFrom.value && histTo.value && new Date(histFrom.value) > new Date(histTo.value)) {
    histError.value = '"Từ ngày" đang đứng sau "Đến ngày" — đổi lại thứ tự thì mới xuất được.'
    return
  }
  try {
    const params = {}
    if (histFrom.value) params.from = histFrom.value
    if (histTo.value)   params.to   = histTo.value
    const res = await api.get('/sensor/export', { params, responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'sensor_data.csv'
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) { console.error(err) }
}

const fetchSettings = async () => {
  try {
    const res = await api.get('/settings')
    if (res.data.thresholds) Object.assign(settings.value, res.data.thresholds)
  } catch (err) { console.error(err) }
}

const saveSettings = async () => {
  try {
    await api.put('/settings', settings.value)
    settingsSaved.value = true
    setTimeout(() => settingsSaved.value = false, 2000)
  } catch (err) { console.error(err) }
}

// Fetch khi chuyển tab
watch(activeTab, (tab) => {
  if (tab === 'alerts')  { fetchAlerts(); fetchAlertStats() }
  if (tab === 'history') fetchHistory()
})

const logout = async () => {
  try {
    await api.post('/auth/logout', { refreshToken: localStorage.getItem('refreshToken') })
  } catch (err) { console.error(err) }
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  router.push('/login')
}

// ── Tự động đăng xuất nếu không thao tác gì trong 1 giờ (bảo mật) ──
const IDLE_LIMIT_MS = 60 * 60 * 1000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
let idleTimer

const handleIdleTimeout = () => {
  alert('Phiên đăng nhập đã hết hạn do không hoạt động. Vui lòng đăng nhập lại để bảo mật.')
  logout()
}
const resetIdleTimer = () => {
  clearTimeout(idleTimer)
  idleTimer = setTimeout(handleIdleTimeout, IDLE_LIMIT_MS)
}

// Trình duyệt tự làm chậm setInterval khi tab bị đẩy xuống nền (vd. đang xem
// tab Wokwi) — nên khi quay lại tab này, fetch ngay lập tức thay vì đợi vòng
// poll 5s tiếp theo (có khi bị hoãn tới cả phút).
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    fetchLive()
    if (activeTab.value === 'alerts') { fetchAlerts(); fetchAlertStats() }
  }
}

let interval
onMounted(async () => {
  // Set default dates cho history tab (24h gần nhất, theo giờ địa phương)
  const now = new Date()
  histTo.value   = toLocalInputValue(now)
  const yesterday = new Date(now - 24 * 60 * 60 * 1000)
  histFrom.value = toLocalInputValue(yesterday)

  await Promise.all([fetchLive(), fetchSettings(), fetchAlerts(), fetchAlertStats(), fetchWeeklyAlerts()])
  interval = setInterval(() => { fetchLive(); fetchAlertStats() }, 5000)

  resetIdleTimer()
  ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, resetIdleTimer))
  document.addEventListener('visibilitychange', handleVisibilityChange)
})
onUnmounted(() => {
  clearInterval(interval)
  clearTimeout(idleTimer)
  ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, resetIdleTimer))
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
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
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 16px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.brand-icon { font-size: 22px; }
.brand-name { color: white; font-weight: 700; font-size: 16px; }

.nav { flex: 1; padding: 12px 8px; display: flex; flex-direction: column; gap: 4px; }
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  cursor: pointer;
  color: rgba(255,255,255,0.5);
  font-size: 13px;
  transition: background 0.15s;
  position: relative;
}
.nav-item:hover  { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8); }
.nav-item.active { background: #1e40af; color: white; }
.nav-icon  { font-size: 15px; }
.nav-label { font-weight: 500; flex: 1; }
.nav-badge {
  background: #ef4444;
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

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
.status-text { color: rgba(255,255,255,0.5); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}
.page-title  { font-size: 16px; font-weight: 700; color: #0f172a; }
.last-update { font-size: 11px; color: #94a3b8; margin-left: 10px; }
.air-index { padding: 5px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; }
.aqi-good   { background: #dcfce7; color: #15803d; }
.aqi-warn   { background: #fef9c3; color: #a16207; }
.aqi-danger { background: #fee2e2; color: #b91c1c; }

/* ── Tab content ── */
.tab-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
  gap: 14px;
  min-height: 0;
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
.metric-card.info    { border-left-color: #8b5cf6; }
.metric-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.metric-label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
.metric-icon  { font-size: 18px; }
.metric-value { font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1; margin-bottom: 8px; }
.metric-value.device-id { font-size: 14px; font-weight: 600; padding-top: 6px; }
.metric-unit  { font-size: 13px; font-weight: 500; color: #94a3b8; margin-left: 2px; }
.metric-bar   { height: 4px; background: #f1f5f9; border-radius: 2px; overflow: hidden; margin-bottom: 6px; }
.metric-fill  { height: 100%; border-radius: 2px; transition: width 0.5s ease; }
.metric-fill.info-fill { background: #8b5cf6; }
.metric-hint      { font-size: 11px; font-weight: 500; }
.metric-hint.ok   { color: #22c55e; }
.metric-hint.warn { color: #f59e0b; }

/* ── Chart ── */
.chart-card {
  background: white;
  border-radius: 12px;
  padding: 14px 16px;
  height: 300px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  flex-shrink: 0;
}
.chart-card.chart-grow { flex: 1; height: auto; min-height: 280px; }
.chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-shrink: 0; }
.chart-title  { font-size: 13px; font-weight: 600; color: #0f172a; display: inline-flex; align-items: center; }
.chart-count  { font-size: 11px; color: #94a3b8; }
.chart-wrap   { flex: 1; min-height: 0; position: relative; }
.no-data { display: flex; align-items: center; justify-content: center; height: 100%; color: #94a3b8; font-size: 13px; }

.live-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #0ca30c;
  margin-right: 7px;
  animation: live-pulse 1.6s ease-in-out infinite;
}
@keyframes live-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(12, 163, 12, 0.5); }
  50%      { box-shadow: 0 0 0 5px rgba(12, 163, 12, 0); }
}

/* ── Mini charts (small multiples) ── */
.mini-charts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}
.mini-charts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  flex-shrink: 0;
}
.chart-card.mini { height: 220px; padding: 12px 14px; }
.chart-card.weekly-card { height: 260px; flex-shrink: 0; }
.hist-mini-charts { flex-shrink: 0; }
.chart-card.hist-mini { height: 320px; }
.chart-title-sm { font-size: 12px; font-weight: 600; color: #0f172a; }
.mini-stats {
  font-size: 10px;
  color: #94a3b8;
  text-align: center;
  padding-top: 6px;
  flex-shrink: 0;
}

/* ── History tab ── */
.history-tab { overflow-y: auto; }
.hist-toolbar {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  background: white;
  padding: 14px 16px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  flex-shrink: 0;
}
.date-range { display: flex; gap: 12px; flex-wrap: wrap; flex: 1; }
.date-input { display: flex; flex-direction: column; gap: 4px; }
.date-input label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; }
.date-input input {
  padding: 7px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  color: #0f172a;
  outline: none;
}
.date-input input:focus { border-color: #3b82f6; }
.hist-actions { display: flex; gap: 8px; align-items: flex-end; }
.hist-stats { display: flex; gap: 8px; flex-wrap: wrap; flex-shrink: 0; }
.hist-error { font-size: 12px; font-weight: 500; color: #d03b3b; flex-shrink: 0; }
.stat-chip {
  background: white;
  border: 1px solid #e2e8f0;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  color: #374151;
  font-weight: 500;
}

/* ── Buttons ── */
.btn-primary {
  padding: 8px 16px;
  background: #1e40af;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.btn-primary:hover:not(:disabled) { background: #1d4ed8; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-export {
  padding: 8px 16px;
  background: #059669;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.btn-export:hover:not(:disabled) { background: #047857; }
.btn-export:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-ghost {
  padding: 7px 14px;
  background: transparent;
  color: #64748b;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
}
.btn-ghost:hover { background: #f8fafc; }
.btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-ghost.btn-danger { color: #d03b3b; border-color: #fecaca; }
.btn-ghost.btn-danger:hover:not(:disabled) { background: #fef2f2; }

/* ── Alerts ── */
.alert-stats-row {
  display: grid;
  grid-template-columns: 1fr 1fr 2fr;
  gap: 12px;
  flex-shrink: 0;
}
.stat-card {
  background: white;
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}
.stat-card-value { font-size: 26px; font-weight: 800; color: #0f172a; line-height: 1; }
.stat-card-label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
.stat-card.warn .stat-card-value { color: #d03b3b; }
.stat-card.type-card { gap: 8px; }
.type-bar-wrap { flex: 1; min-height: 72px; position: relative; }
.no-data.small { font-size: 11px; height: 72px; }

.alerts-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  flex-shrink: 0;
}
.filter-tabs { display: flex; gap: 4px; }
.toolbar-actions { display: flex; gap: 8px; }
.filter-btn {
  padding: 7px 14px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}
.filter-btn.active { background: #1e40af; color: white; border-color: #1e40af; }
.badge {
  background: #ef4444;
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
}
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px; color: #94a3b8; font-size: 13px; }
.empty-state span { font-size: 32px; }
.alerts-list { display: flex; flex-direction: column; gap: 8px; }
.alert-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: white;
  padding: 12px 16px;
  border-radius: 10px;
  border-left: 3px solid #f59e0b;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  transition: opacity 0.2s;
}
.alert-row.alert-co2         { border-left-color: #10b981; }
.alert-row.alert-temperature { border-left-color: #ef4444; }
.alert-row.alert-humidity    { border-left-color: #3b82f6; }
.alert-row.resolved          { opacity: 0.45; }
.alert-icon  { font-size: 20px; flex-shrink: 0; }
.alert-body  { flex: 1; min-width: 0; }
.alert-msg   { font-size: 13px; color: #374151; font-weight: 500; }
.alert-meta  { font-size: 11px; color: #94a3b8; margin-top: 2px; }
.alert-actions { display: flex; gap: 6px; flex-shrink: 0; }
.btn-resolve {
  padding: 5px 12px;
  background: #dcfce7;
  color: #15803d;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.btn-resolve:hover { background: #bbf7d0; }
.btn-del {
  padding: 5px 8px;
  background: #fee2e2;
  color: #b91c1c;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.btn-del:hover { background: #fecaca; }

/* ── Devices ── */
.device-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); max-width: 500px; }
.device-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.device-name { font-size: 15px; font-weight: 700; color: #0f172a; }
.device-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.device-info-item { display: flex; flex-direction: column; gap: 3px; }
.di-label { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; }
.di-value { font-size: 13px; font-weight: 500; color: #0f172a; }

/* ── Settings ── */
.settings-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  max-width: 560px;
}
.settings-title { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
.settings-desc  { font-size: 13px; color: #64748b; margin-bottom: 20px; }
.settings-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.setting-item   { display: flex; flex-direction: column; gap: 6px; }
.setting-item label { font-size: 12px; font-weight: 600; color: #374151; }
.setting-item input {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #0f172a;
  outline: none;
  width: 100%;
}
.setting-item input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
.settings-footer { margin-top: 24px; }
.btn-save {
  padding: 10px 24px;
  background: #1e40af;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-save:hover { background: #1d4ed8; }
.btn-save.saved { background: #059669; }

/* ── Mobile responsive ── */
@media (max-width: 768px) {
  .sidebar { width: 56px; min-width: 56px; }
  .brand-name, .nav-label, .sidebar-footer .status-text { display: none; }
  .nav-item { justify-content: center; padding: 10px; }
  .nav-badge { position: absolute; top: 4px; right: 4px; }
  .logout-btn { font-size: 0; padding: 8px; text-align: center; }
  .logout-btn::before { content: '⎋'; font-size: 14px; }
  .metrics { grid-template-columns: 1fr 1fr; }
  .mini-charts { grid-template-columns: 1fr; }
  .alert-stats-row { grid-template-columns: 1fr 1fr; }
  .topbar { padding: 10px 14px; }
  .tab-content { padding: 10px 12px; }
}

@media (max-width: 480px) {
  .metrics { grid-template-columns: 1fr; }
  .alert-stats-row { grid-template-columns: 1fr; }
  .settings-grid { grid-template-columns: 1fr; }
  .hist-toolbar { flex-direction: column; align-items: stretch; }
  .hist-actions { flex-direction: row; }
}
</style>
