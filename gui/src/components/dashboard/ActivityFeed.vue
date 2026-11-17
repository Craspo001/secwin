<script setup lang="ts">
import { CheckCircle, AlertCircle, Info, Clock, ExternalLink } from 'lucide-vue-next'

interface Activity {
  type: 'playbook' | 'tool' | 'profile' | 'evidence' | 'benchmark'
  message: string
  time: string
  status: 'success' | 'error' | 'info' | 'warning'
}

interface Props {
  activities: Activity[]
}

const props = defineProps<Props>()

const getIcon = (type: Activity['type'], status: Activity['status']) => {
  if (status === 'success') return CheckCircle
  if (status === 'error') return AlertCircle
  return Info
}

const getTypeLabel = (type: Activity['type']) => {
  const labels: Record<Activity['type'], string> = {
    playbook: 'Playbook',
    tool: 'Tool',
    profile: 'Profile',
    evidence: 'Evidence',
    benchmark: 'Benchmark',
  }
  return labels[type]
}

const getStatusColor = (status: Activity['status']) => {
  switch (status) {
    case 'success': return 'text-success'
    case 'error': return 'text-danger'
    case 'warning': return 'text-warning'
    default: return 'text-info'
  }
}
</script>

<template>
  <div class="activity-feed space-y-md">
    <div
      v-for="(activity, index) in props.activities"
      :key="index"
      class="flex items-start gap-md p-sm rounded hover:bg-bg-tertiary transition-colors"
    >
      <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" :class="[
        activity.status === 'success' && 'bg-success-bg text-success',
        activity.status === 'error' && 'bg-danger-bg text-danger',
        activity.status === 'warning' && 'bg-warning-bg text-warning',
        activity.status === 'info' && 'bg-info-bg text-info',
      ]">
        <component :is="getIcon(activity.type, activity.status)" size="16" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-sm">
          <span class="font-medium text-sm">{{ activity.message }}</span>
          <span class="badge badge-neutral text-xs">{{ getTypeLabel(activity.type) }}</span>
        </div>
        <p class="text-xs text-muted mt-1 flex items-center gap-xs">
          <Clock size="12" />
          {{ activity.time }}
        </p>
      </div>
      <ExternalLink size="14" class="text-muted hover:text-primary transition-colors" />
    </div>
  </div>
</template>

<style scoped>
.activity-feed {
  max-height: 400px;
  overflow-y: auto;
}
</style>