<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Play, Plus, Shield, Download, Brain, BarChart2 } from 'lucide-vue-next'

const router = useRouter()

const actions = [
  {
    label: 'Run Playbook',
    description: 'Execute a security playbook',
    icon: Play,
    color: 'primary',
    action: () => router.push('/playbooks'),
  },
  {
    label: 'Create Profile',
    description: 'Set up new OpSec profile',
    icon: Plus,
    color: 'success',
    action: () => router.push('/profiles'),
  },
  {
    label: 'Engage OpSec',
    description: 'Activate MAC spoofing, VPN, etc.',
    icon: Shield,
    color: 'warning',
    action: () => router.push('/profiles'),
  },
  {
    label: 'View Evidence',
    description: 'Browse collected artifacts',
    icon: Download,
    color: 'info',
    action: () => router.push('/evidence'),
  },
  {
    label: 'AI Triage',
    description: 'Analyze findings with Ollama',
    icon: Brain,
    color: 'danger',
    action: () => router.push('/ollama'),
  },
  {
    label: 'Run Benchmark',
    description: 'Performance testing suite',
    icon: BarChart2,
    color: 'primary',
    action: () => router.push('/benchmarks'),
  },
]
</script>

<template>
  <Card>
    <template #header>
      <h3 class="card-title">Quick Actions</h3>
    </template>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-sm">
      <button
        v-for="action in actions"
        :key="action.label"
        class="btn btn-secondary w-full text-left p-md hover:shadow-md transition-all"
        @click="action.action"
      >
        <div class="flex items-start gap-md">
          <div class="avatar avatar-sm" :class="[
            action.color === 'primary' && 'bg-brand-primary text-white',
            action.color === 'success' && 'bg-success-bg text-success',
            action.color === 'warning' && 'bg-warning-bg text-warning',
            action.color === 'info' && 'bg-info-bg text-info',
            action.color === 'danger' && 'bg-danger-bg text-danger',
          ]">
            <component :is="action.icon" size="18" />
          </div>
          <div class="flex-1">
            <p class="font-medium">{{ action.label }}</p>
            <p class="text-xs text-muted">{{ action.description }}</p>
          </div>
        </div>
      </button>
    </div>
  </Card>
</template>

<style scoped>
/* Color utility classes */
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