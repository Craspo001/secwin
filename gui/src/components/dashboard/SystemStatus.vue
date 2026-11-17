<script setup lang="ts">
import { CheckCircle, AlertCircle, Info, Monitor, Cpu, HardDrive, Wifi, Terminal } from 'lucide-vue-next'

interface Props {
  systemInfo: any
}

const props = defineProps<Props>()

const checks = computed(() => {
  const info = props.systemInfo
  if (!info) return []

  return [
    {
      label: 'SecWin CLI',
      status: info.secwin_path ? 'success' : 'error',
      message: info.secwin_path ? `v${info.secwin_version?.replace('secwin ', '') || 'installed'}` : 'Not found in PATH',
      icon: Terminal,
    },
    {
      label: 'Operating System',
      status: 'info',
      message: `${info.os} ${info.os_version} (${info.arch})`,
      icon: Monitor,
    },
    {
      label: 'WSL',
      status: info.wsl_available ? 'success' : 'warning',
      message: info.wsl_available
        ? `${info.wsl_distros.length} distro(s): ${info.wsl_distros.join(', ')}`
        : 'Not available - install WSL for Linux tools',
      icon: Cpu,
    },
    {
      label: 'Ollama AI',
      status: info.ollama_available ? 'success' : 'info',
      message: info.ollama_available
        ? `${info.ollama_models.length} model(s) available`
        : 'Not running - start Ollama for AI triage',
      icon: Brain,
    },
    {
      label: 'Hostname',
      status: 'info',
      message: info.hostname,
      icon: Wifi,
    },
    {
      label: 'User',
      status: 'info',
      message: info.username,
      icon: User,
    },
  ]
})
</script>

<template>
  <Card>
    <template #header>
      <h3 class="card-title">System Status</h3>
    </template>
    <div class="space-y-md">
      <div
        v-for="check in checks"
        :key="check.label"
        class="flex items-center gap-md p-sm rounded hover:bg-bg-tertiary transition-colors"
      >
        <div class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-bg-tertiary">
          <component :is="check.icon" size="20" class="text-muted" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-medium text-sm">{{ check.label }}</p>
          <p class="text-xs text-muted truncate">{{ check.message }}</p>
        </div>
        <div class="flex items-center gap-sm">
          <span
            class="w-2 h-2 rounded-full"
            :class="[
              check.status === 'success' && 'bg-success',
              check.status === 'error' && 'bg-danger',
              check.status === 'warning' && 'bg-warning',
              check.status === 'info' && 'bg-info',
            ]"
          />
          <span class="text-xs font-medium" :class="[
            check.status === 'success' && 'text-success',
            check.status === 'error' && 'text-danger',
            check.status === 'warning' && 'text-warning',
            check.status === 'info' && 'text-info',
          ]">
            {{ check.status.charAt(0).toUpperCase() + check.status.slice(1) }}
          </span>
        </div>
      </div>
    </div>
  </Card>
</template>

<style scoped>
/* Color utility classes */
.bg-success { background: var(--color-success); }
.bg-danger { background: var(--color-danger); }
.bg-warning { background: var(--color-warning); }
.bg-info { background: var(--color-info); }
</style>