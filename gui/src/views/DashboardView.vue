<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useSystemStore } from '@/stores/system'
import { usePlaybookStore } from '@/stores/playbook'
import { useProfileStore } from '@/stores/profile'
import { useEvidenceStore } from '@/stores/evidence'
import { useOllamaStore } from '@/stores/ollama'
import { useBenchmarkStore } from '@/stores/benchmark'
import { useToolsStore } from '@/stores/tools'
import { Card } from '@/components/ui/Card.vue'
import { StatCard } from '@/components/ui/StatCard.vue'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed.vue'
import { QuickActions } from '@/components/dashboard/QuickActions.vue'
import { SystemStatus } from '@/components/dashboard/SystemStatus.vue'
import {
  BookOpen,
  Wrench,
  Shield,
  Archive,
  Brain,
  BarChart2,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
} from 'lucide-vue-next'

const systemStore = useSystemStore()
const playbookStore = usePlaybookStore()
const profileStore = useProfileStore()
const evidenceStore = useEvidenceStore()
const ollamaStore = useOllamaStore()
const benchmarkStore = useBenchmarkStore()
const toolsStore = useToolsStore()

const stats = computed(() => [
  {
    label: 'Playbooks',
    value: playbookStore.playbooks.length,
    icon: BookOpen,
    trend: '+2 this week',
    color: 'primary',
  },
  {
    label: 'Tools Installed',
    value: toolsStore.installedTools.length,
    icon: Wrench,
    trend: `${toolsStore.availableTools.length} available`,
    color: 'success',
  },
  {
    label: 'Active Profiles',
    value: profileStore.profiles.filter(p => p.active).length,
    icon: Shield,
    trend: profileStore.activeProfile ? '1 active' : 'None active',
    color: 'warning',
  },
  {
    label: 'Evidence Artifacts',
    value: evidenceStore.artifacts.length,
    icon: Archive,
    trend: 'Auto-collected',
    color: 'info',
  },
])

const recentActivity = ref([
  { type: 'playbook', message: 'External Recon completed', time: '2 hours ago', status: 'success' },
  { type: 'tool', message: 'Nuclei installed via Scoop', time: '4 hours ago', status: 'success' },
  { type: 'profile', message: 'OpSec profile "engagement-1" engaged', time: '1 day ago', status: 'info' },
  { type: 'evidence', message: 'New artifact: nuclei-results.json', time: '1 day ago', status: 'success' },
  { type: 'benchmark', message: 'Benchmark suite completed', time: '2 days ago', status: 'success' },
])

const quickStats = computed(() => ({
  playbooksRun: 42,
  toolsInstalled: toolsStore.installedTools.length,
  findingsTriaged: 156,
  benchmarksRun: 8,
}))

onMounted(async () => {
  await Promise.all([
    systemStore.fetchSystemInfo(),
    playbookStore.fetchPlaybooks(),
    profileStore.fetchProfiles(),
    profileStore.fetchOpSecStatus(),
    evidenceStore.fetchEvidence(),
    ollamaStore.fetchModels(),
    toolsStore.fetchTools(),
  ])
})
</script>

<template>
  <div class="dashboard">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-md mb-xl">
      <div>
        <h1 class="text-3xl font-bold">Dashboard</h1>
        <p class="text-muted mt-xs">Overview of your security operations</p>
      </div>
      <div class="flex items-center gap-sm">
        <span class="badge badge-success flex items-center gap-xs">
          <CheckCircle size="12" /> SecWin Ready
        </span>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md mb-xl">
      <StatCard
        v-for="stat in stats"
        :key="stat.label"
        :label="stat.label"
        :value="stat.value"
        :icon="stat.icon"
        :trend="stat.trend"
        :color="stat.color"
      />
    </div>

    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-lg">
      <!-- Left Column -->
      <div class="lg:col-span-2 space-y-lg">
        <!-- System Status -->
        <SystemStatus :system-info="systemStore.systemInfo" />

        <!-- Activity Feed -->
        <Card>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="card-title">Recent Activity</h3>
              <router-link to="/playbooks" class="text-sm text-primary">View All</router-link>
            </div>
          </template>
          <ActivityFeed :activities="recentActivity" />
        </Card>
      </div>

      <!-- Right Column -->
      <div class="space-y-lg">
        <!-- Quick Actions -->
        <QuickActions />

        <!-- Quick Stats -->
        <Card>
          <template #header>
            <h3 class="card-title">Quick Stats</h3>
          </template>
          <div class="space-y-md">
            <div class="flex items-center justify-between">
              <span class="text-muted">Playbooks Run</span>
              <span class="font-semibold text-2xl text-primary">{{ quickStats.playbooksRun }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted">Tools Installed</span>
              <span class="font-semibold text-2xl text-success">{{ quickStats.toolsInstalled }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted">Findings Triaged</span>
              <span class="font-semibold text-2xl text-warning">{{ quickStats.findingsTriaged }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted">Benchmarks Run</span>
              <span class="font-semibold text-2xl text-info">{{ quickStats.benchmarksRun }}</span>
            </div>
          </div>
        </Card>

        <!-- Active Runs -->
        <Card v-if="playbookStore.activeRuns.length > 0">
          <template #header>
            <h3 class="card-title">Active Playbook Runs</h3>
          </template>
          <div class="space-y-sm">
            <div
              v-for="run in playbookStore.activeRuns"
              :key="run.id"
              class="flex items-center justify-between p-sm rounded bg-bg-tertiary"
            >
              <div class="flex items-center gap-sm">
                <div class="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <div>
                  <p class="font-medium text-sm">{{ run.playbook }}</p>
                  <p class="text-xs text-muted">Step {{ run.steps_completed }} of {{ run.steps_total }}</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm font-medium">{{ Math.round(run.progress) }}%</p>
                <router-link
                  :to="`/playbooks/runs/${run.id}`"
                  class="text-xs text-primary"
                >
                  View Details
                </router-link>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-pulse {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>