<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlaybookStore } from '@/stores/playbook'
import { Card } from '@/components/ui/Card.vue'
import { ChevronLeft, RefreshCw, X, CheckCircle, AlertCircle, Clock, FileText, ExternalLink, Download, PauseCircle, PlayCircle } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const playbookStore = usePlaybookStore()

const runId = computed(() => route.params.runId as string)
const status = ref<any>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const pollInterval = ref<number | null>(null)
const logs = ref<string[]>([])

async function fetchStatus() {
  try {
    const result = await playbookStore.getPlaybookStatus(runId.value)
    if (result) {
      status.value = result
      if (result.status === 'running') {
        startPolling()
      } else {
        stopPolling()
      }
    } else {
      error.value = 'Run not found'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to fetch status'
  } finally {
    loading.value = false
  }
}

function startPolling() {
  if (pollInterval.value) return
  pollInterval.value = window.setInterval(fetchStatus, 2000)
}

function stopPolling() {
  if (pollInterval.value) {
    clearInterval(pollInterval.value)
    pollInterval.value = null
  }
}

async function stopRun() {
  try {
    await playbookStore.stopPlaybook(runId.value)
    await fetchStatus()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to stop run'
  }
}

function goBack() {
  router.push('/playbooks')
}

function formatDuration(ms: number | null) {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'running': return PauseCircle
    case 'completed': return CheckCircle
    case 'failed': return AlertCircle
    case 'stopped': return X
    default: return Clock
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'running': return 'text-primary'
    case 'completed': return 'text-success'
    case 'failed': return 'text-danger'
    case 'stopped': return 'text-warning'
    default: return 'text-muted'
  }
}

onMounted(() => {
  fetchStatus()
})

onUnmounted(() => {
  stopPolling()
})

watch(runId, () => {
  fetchStatus()
})
</script>

<template>
  <div class="playbook-run-status-view">
    <!-- Header -->
    <div class="flex items-center gap-md mb-xl">
      <button class="btn btn-ghost btn-sm" @click="goBack">
        <ChevronLeft size="18" />
        Back
      </button>

      <div v-if="status" class="flex-1">
        <h1 class="text-3xl font-bold">{{ status.playbook }}</h1>
        <p class="text-muted">Run ID: {{ status.id.slice(0, 8) }}...</p>
      </div>

      <div v-if="status" class="flex items-center gap-sm">
        <button v-if="status.status === 'running'" class="btn btn-warning" @click="stopRun">
          <PauseCircle size="16" /> Stop
        </button>
        <button class="btn btn-secondary" @click="fetchStatus" :disabled="loading">
          <RefreshCw size="16" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-2xl">
      <div class="animate-spin rounded-full border-4 border-primary border-t-transparent w-8 h-8" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="card border-danger">
      <div class="flex items-center gap-md p-md">
        <X class="text-danger" size="24" />
        <div>
          <p class="font-medium">{{ error }}</p>
          <button class="btn btn-ghost btn-sm mt-sm" @click="fetchStatus">Retry</button>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div v-else-if="status" class="grid grid-cols-1 lg:grid-cols-3 gap-lg">
      <!-- Main Status -->
      <div class="lg:col-span-2 space-y-lg">
        <!-- Status Card -->
        <Card class="border-l-4" :class="[
          status.status === 'running' && 'border-primary',
          status.status === 'completed' && 'border-success',
          status.status === 'failed' && 'border-danger',
          status.status === 'stopped' && 'border-warning',
        ]">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-md">
              <component
                :is="getStatusIcon(status.status)"
                size="32"
                :class="getStatusColor(status.status)"
              />
              <div>
                <p class="text-2xl font-bold" :class="getStatusColor(status.status)">
                  {{ status.status.charAt(0).toUpperCase() + status.status.slice(1) }}
                </p>
                <p class="text-muted">
                  {{ status.current_step ? `Step: ${status.current_step}` : 'Initializing...' }}
                </p>
              </div>
            </div>
            <div class="text-right">
              <p class="text-sm text-muted">Progress</p>
              <p class="text-3xl font-bold" :class="getStatusColor(status.status)">
                {{ Math.round(status.progress) }}%
              </p>
            </div>
          </div>

          <div class="progress mt-md">
            <div class="progress-bar" :style="{ width: status.progress + '%' }" />
          </div>

          <div class="grid grid-cols-3 gap-md mt-md text-center">
            <div>
              <p class="text-2xl font-bold">{{ status.steps_completed }} / {{ status.steps_total }}</p>
              <p class="text-xs text-muted">Steps</p>
            </div>
            <div>
              <p class="text-2xl font-bold">{{ status.findings_count }}</p>
              <p class="text-xs text-muted">Findings</p>
            </div>
            <div>
              <p class="text-2xl font-bold">{{ status.artifacts_count }}</p>
              <p class="text-xs text-muted">Artifacts</p>
            </div>
          </div>
        </Card>

        <!-- Timing Info -->
        <Card>
          <template #header>
            <h3 class="card-title">Timing</h3>
          </template>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-md">
            <div>
              <p class="text-sm text-muted">Started</p>
              <p class="font-medium">{{ new Date(status.started_at).toLocaleString() }}</p>
            </div>
            <div>
              <p class="text-sm text-muted">Completed</p>
              <p class="font-medium">{{ status.completed_at ? new Date(status.completed_at).toLocaleString() : '—' }}</p>
            </div>
            <div>
              <p class="text-sm text-muted">Duration</p>
              <p class="font-medium">{{ formatDuration(status.duration_ms) }}</p>
            </div>
          </div>
        </Card>

        <!-- Steps -->
        <Card>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="card-title">Step Progress</h3>
            </div>
          </template>
          <div v-if="status.steps_completed > 0 || status.steps_total > 0" class="space-y-sm">
            <div
              v-for="i in status.steps_total"
              :key="i"
              class="flex items-center gap-md p-sm rounded hover:bg-bg-tertiary"
            >
              <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                :class="[
                  i < status.steps_completed ? 'bg-success text-white' :
                  i === status.steps_completed && status.status === 'running' ? 'bg-primary text-white animate-pulse' :
                  'bg-bg-tertiary text-muted'
                ]"
              >
                {{ i }}
              </div>
              <div class="flex-1">
                <p class="font-medium text-sm">Step {{ i }}</p>
                <p class="text-xs text-muted">
                  {{ i < status.steps_completed ? 'Completed' : i === status.steps_completed ? 'Running...' : 'Pending' }}
                </p>
              </div>
              <div v-if="i < status.steps_completed" class="text-success">
                <CheckCircle size="16" />
              </div>
              <div v-else-if="i === status.steps_completed && status.status === 'running'" class="text-primary">
                <div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          </div>
          <p v-else class="text-muted text-center py-md">Step details will appear as the playbook runs</p>
        </Card>

        <!-- Report Output -->
        <Card v-if="status.report_path">
          <template #header>
            <h3 class="card-title">Report Generated</h3>
          </template>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-md">
              <FileText class="text-primary" size="24" />
              <div>
                <p class="font-medium">Report Available</p>
                <p class="text-sm text-muted font-mono truncate max-w-md">{{ status.report_path }}</p>
              </div>
            </div>
            <div class="flex items-center gap-sm">
              <button class="btn btn-primary" @click="openReport">
                <ExternalLink size="16" /> Open
              </button>
              <button class="btn btn-secondary" @click="downloadReport">
                <Download size="16" /> Download
              </button>
            </div>
          </div>
        </Card>

        <!-- Error Display -->
        <Card v-if="status.error" class="border-danger">
          <template #header>
            <h3 class="card-title text-danger">Error</h3>
          </template>
          <pre class="bg-danger-bg text-danger p-md rounded font-mono text-sm overflow-x-auto">{{ status.error }}</pre>
        </Card>
      </div>

      <!-- Sidebar -->
      <div class="space-y-lg">
        <!-- Run Info -->
        <Card>
          <template #header>
            <h3 class="card-title">Run Details</h3>
          </template>
          <div class="space-y-md">
            <div>
              <p class="text-sm text-muted">Run ID</p>
              <p class="font-mono text-xs break-all">{{ status.id }}</p>
            </div>
            <div>
              <p class="text-sm text-muted">Playbook</p>
              <p class="font-medium">{{ status.playbook }}</p>
            </div>
            <div>
              <p class="text-sm text-muted">Status</p>
              <span class="badge" :class="[
                status.status === 'running' && 'badge-info',
                status.status === 'completed' && 'badge-success',
                status.status === 'failed' && 'badge-danger',
                status.status === 'stopped' && 'badge-warning',
              ]">
                {{ status.status }}
              </span>
            </div>
          </div>
        </Card>

        <!-- Actions -->
        <Card>
          <template #header>
            <h3 class="card-title">Actions</h3>
          </template>
          <div class="space-y-sm">
            <button v-if="status.status === 'running'" class="btn btn-warning w-full justify-start" @click="stopRun">
              <PauseCircle size="18" /> Stop Run
            </button>
            <button v-if="status.report_path" class="btn btn-primary w-full justify-start" @click="openReport">
              <ExternalLink size="18" /> View Report
            </button>
            <button v-if="status.status === 'completed' || status.status === 'failed'" class="btn btn-secondary w-full justify-start" @click="goToPlaybook">
              <ChevronLeft size="18" /> Back to Playbook
            </button>
            <button class="btn btn-ghost w-full justify-start" @click="goBack">
              <X size="18" /> Back to Playbooks
            </button>
          </div>
        </Card>

        <!-- Live Logs -->
        <Card>
          <template #header>
            <h3 class="card-title">Live Output</h3>
          </template>
          <div class="font-mono text-xs bg-bg-primary rounded p-md max-h-64 overflow-y-auto border border-border-light" style="font-family: var(--font-mono);">
            <div v-if="logs.length === 0" class="text-muted text-center py-md">
              Output will appear here...
            </div>
            <div v-else class="space-y-1">
              <div v-for="(log, index) in logs" :key="index" class="text-text-secondary">
                {{ log }}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  methods: {
    openReport() {
      if (this.status?.report_path) {
        window.open(this.status.report_path, '_blank')
      }
    },
    downloadReport() {
      if (this.status?.report_path) {
        window.open(this.status.report_path, '_blank')
      }
    },
    goToPlaybook() {
      this.$router.push({ name: 'PlaybookDetail', params: { id: this.status.playbook } })
    },
  },
}
</script>

<style scoped>
.playbook-run-status-view {
  animation: fadeIn 0.3s ease;
}

.animate-pulse {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.border-l-4 {
  border-left-width: 4px;
}
</style>