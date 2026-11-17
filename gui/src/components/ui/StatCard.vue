<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  label: string
  value: number | string
  icon: any
  trend?: string
  color?: 'primary' | 'success' | 'warning' | 'info' | 'danger'
}

const props = withDefaults(defineProps<Props>(), {
  color: 'primary',
})

const colorClasses = computed(() => ({
  card: '',
  iconBg: '',
  iconColor: '',
  trendColor: '',
}))

const iconBgClass = computed(() => {
  switch (props.color) {
    case 'success': return 'bg-success-bg'
    case 'warning': return 'bg-warning-bg'
    case 'info': return 'bg-info-bg'
    case 'danger': return 'bg-danger-bg'
    default: return 'bg-brand-primary'
  }
})

const iconColorClass = computed(() => {
  switch (props.color) {
    case 'success': return 'text-success'
    case 'warning': return 'text-warning'
    case 'info': return 'text-info'
    case 'danger': return 'text-danger'
    default: return 'text-white'
  }
})

const trendColorClass = computed(() => {
  if (!props.trend) return ''
  if (props.trend.startsWith('+') || props.trend.includes('active')) return 'text-success'
  if (props.trend.includes('available') || props.trend.includes('None')) return 'text-muted'
  return 'text-primary'
})
</script>

<template>
  <div class="card">
    <div class="flex items-start justify-between">
      <div>
        <p class="text-sm text-muted">{{ props.label }}</p>
        <p class="text-3xl font-bold mt-1">{{ props.value }}</p>
        <p v-if="props.trend" :class="['text-sm mt-1', trendColorClass]">{{ props.trend }}</p>
      </div>
      <div
        class="avatar"
        :class="[iconBgClass, iconColorClass]"
      >
        <component :is="props.icon" size="24" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Color utility classes used in computed */
.bg-brand-primary { background: var(--color-brand-primary); }
.bg-success-bg { background: var(--color-success-bg); }
.bg-warning-bg { background: var(--color-warning-bg); }
.bg-info-bg { background: var(--color-info-bg); }
.bg-danger-bg { background: var(--color-danger-bg); }

.text-white { color: var(--color-text-inverse); }
.text-success { color: var(--color-success); }
.text-warning { color: #856404; }
.text-info { color: var(--color-info); }
.text-danger { color: var(--color-danger); }
</style>