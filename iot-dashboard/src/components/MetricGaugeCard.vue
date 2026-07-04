<template>
  <div class="gauge-card" :style="{ '--gauge-color': color }">
    <div class="gauge-top">
      <span class="gauge-label">{{ label }}</span>
      <span class="gauge-icon">{{ icon }}</span>
    </div>

    <div class="gauge-body">
      <svg class="gauge-ring" viewBox="0 0 100 100">
        <circle class="gauge-track" cx="50" cy="50" r="42" />
        <circle
          class="gauge-fill"
          cx="50" cy="50" r="42"
          :style="{ strokeDasharray: CIRCUMFERENCE, strokeDashoffset: dashOffset }"
        />
      </svg>
      <div class="gauge-value">
        {{ value }}<span class="gauge-unit">{{ unit }}</span>
      </div>
    </div>

    <svg v-if="sparklinePoints" class="sparkline" viewBox="0 0 100 28" preserveAspectRatio="none">
      <polyline :points="sparklinePoints" />
    </svg>

    <div class="gauge-hint" :class="ok ? 'ok' : 'warn'">{{ hint }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  icon: { type: String, required: true },
  value: { type: [String, Number], required: true },
  unit: { type: String, default: '' },
  pct: { type: Number, default: 0 },
  color: { type: String, default: '#0ca30c' },
  hint: { type: String, default: '' },
  ok: { type: Boolean, default: true },
  sparklinePoints: { type: String, default: '' },
})

const RADIUS = 42
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const dashOffset = computed(() => {
  const clamped = Math.min(Math.max(props.pct, 0), 100)
  return CIRCUMFERENCE * (1 - clamped / 100)
})
</script>

<style scoped>
.gauge-card {
  background: white;
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.gauge-top { display: flex; justify-content: space-between; align-items: center; }
.gauge-label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.gauge-icon { font-size: 18px; }

.gauge-body {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 108px;
}
.gauge-ring { width: 108px; height: 108px; transform: rotate(-90deg); }
.gauge-track { fill: none; stroke: #eef2f7; stroke-width: 9; }
.gauge-fill {
  fill: none;
  stroke: var(--gauge-color, #0ca30c);
  stroke-width: 9;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s ease, stroke 0.3s ease;
}
.gauge-value {
  position: absolute;
  font-size: 22px;
  font-weight: 800;
  color: #0f172a;
  line-height: 1;
  text-align: center;
}
.gauge-unit { font-size: 12px; font-weight: 500; color: #94a3b8; margin-left: 2px; }

.sparkline { width: 100%; height: 24px; display: block; }
.sparkline polyline {
  fill: none;
  stroke: var(--gauge-color, #94a3b8);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.55;
}

.gauge-hint { font-size: 11px; font-weight: 500; text-align: center; }
.gauge-hint.ok   { color: #0ca30c; }
.gauge-hint.warn { color: var(--gauge-color, #d03b3b); }
</style>
