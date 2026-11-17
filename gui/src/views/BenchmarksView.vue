<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useBenchmarkStore } from '@/stores/benchmark'
import { usePlaybookStore } from '@/stores/playbook'
import { Card } from '@/components/ui/Card.vue'
import { Play, RefreshCw, BarChart2, Clock, CheckCircle, X, Download, ExternalLink, RotateCw, Settings, Trash2 } from 'lucide-vue-next'

const benchmarkStore = useBenchmarkStore()
const playbookStore = usePlaybookStore()

const iterations = ref(3)
const selectedPlaybooks = ref<string[]>([])
const includeInstall = ref(false)
const includeWsl = ref(true)
const running = ref(false)
const showResults = ref(false)
const currentBenchmarkId = ref<string | null>(null)

const availablePlaybooks = computed(() => playbookStore.playbooks.map(p => p.name))

async function fetchPlaybooks() {
  await playbookStore.fetchPlaybooks()
  if (playbookStore.playbooks.length > 0 && selectedPlaybooks.value.length === 0) {
    selectedPlaybooks.value = playbookStore.playbooks.slice(0, 2).map(p => p.name)
  }
}

async function startBenchmark() {
  if (selectedPlaybooks.value.length === 0) {
    alert('Please select at least one playbook')
    return
  }

  running.value = true
  showResults.value = false
  try {
    const id = await benchmarkStore.startBenchmark({
      iterations: iterations.value,
      playbooks: selectedPlaybooks.value,
      include_install: includeInstall.value,
      include_wsl: includeWsl.value,
    })
    currentBenchmarkId.value = id
    benchmarkStore.pollBenchmark(id)
    showResults.value = true
  } catch (e) {
    console.error('Benchmark failed:', e)
    running.value = false
  }
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

function getSuccessRateColor(rate: number) {
  if (rate >= 0.9) return 'text-success'
  if (rate >= 0.5) return 'text-warning'
  return 'text-danger'
}

onMounted(() => {
  fetchPlaybooks()
})

watch(() => benchmarkStore.currentBenchmark, (bench) => {
  if (bench && bench.completed_at) {
    running.value = false
  }
}, { immediate: true })
</script>

<template>
  <div class="benchmarks-view">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-md mb-xl">
      <div>
        <h1 class="text-3xl font-bold">Benchmarks</h1>
        <p class="text-muted mt-xs">Performance testing and regression detection</p>
      </div>
    </div>

    <!-- Configuration -->
    <Card class="mb-lg">
      <template #header>
        <h3 class="card-title">Benchmark Configuration</h3>
      </template>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md mb-md">
        <div>
          <label class="block text-sm font-medium mb-sm">Iterations</label>
          <input
            v-model.number="iterations"
            type="number"
            min="1"
            max="20"
            class="input"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-sm">Playbooks</label>
          <select
            v-model="selectedPlaybooks"
            multiple
            class="input select"
            style="height: 100px;"
          >
            <option v-for="pb in availablePlaybooks" :key="pb" :value="pb">{{ pb }}</option>
          </select>
          <p class="text-xs text-muted mt-1">Hold Ctrl/Cmd to select multiple</p>
        </div>
        <div class="flex items-end">
          <label class="flex items-center gap-sm cursor-pointer w-full">
            <input type="checkbox" v-model="includeInstall" class="w-4 h-4" />
            <span class="text-sm">Include tool installation</span>
          </label>
        </div>
        <div class="flex items-end">
          <label class="flex items-center gap-sm cursor-pointer w-full">
            <input type="checkbox" v-model="includeWsl" class="w-4 h-4" />
            <span class="text-sm">Test WSL execution</span>
          </label>
        </div>
      </div>

      <button
        class="btn btn-primary btn-lg w-full sm:w-auto"
        @click="startBenchmark"
        :disabled="running || selectedPlaybooks.length === 0"
      >
        <RotateCw v-if="running" class="animate-spin" size="20" />
        <Play v-else size="20" />
        {{ running ? 'Running Benchmark...' : 'Start Benchmark' }}
      </button>
    </Card>

    <!-- Running Status -->
    <Card v-if="running && benchmarkStore.currentBenchmark" class="mb-lg border-primary">
      <template #header>
        <h3 class="card-title">Benchmark Running</h3>
      </template>
      <div class="space-y-md">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium">Iteration {{ benchmarkStore.currentBenchmark.playbooks[0]?.runs.length || 0 }} / {{ iterations }}</p>
            <p class="text-sm text-muted">{{ benchmarkStore.currentBenchmark.playbooks[0]?.playbook }}</p>
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold text-primary">{{ formatDuration(benchmarkStore.currentBenchmark.duration_ms || 0) }}</p>
          </div>
        </div>
        <div class="progress">
          <div class="progress-bar" :style="{ width: ((benchmarkStore.currentBenchmark.playbooks[0]?.runs.length || 0) / iterations * 100) + '%' }" />
        </div>
        <div class="grid grid-cols-3 gap-md text-center text-sm">
          <div>
            <p class="font-bold text-success">{{ benchmarkStore.currentBenchmark.summary.successful_runs }}</p>
            <p class="text-muted">Passed</p>
          </div>
          <div>
            <p class="font-bold text-danger">{{ benchmarkStore.currentBenchmark.summary.failed_runs }}</p>
            <p class="text-muted">Failed</p>
          </div>
          <div>
            <p class="font-bold">{{ benchmarkStore.currentBenchmark.summary.total_runs }}</p>
            <p class="text-muted">Total</p>
          </div>
        </div>
      </div>
    </Card>

    <!-- Results -->
    <div v-if="showResults && benchmarkStore.currentBenchmark" class="space-y-lg">
      <!-- Summary -->
      <Card>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="card-title">Benchmark Summary</h3>
            <div class="flex items-center gap-sm">
              <button class="btn btn-ghost btn-sm" @click="downloadResults">
                <Download size="16" /> Export
              </button>
              <button class="btn btn-ghost btn-sm" @click="showResults = false">
                <X size="16" /> Close
              </button>
            </div>
          </div>
        </template>
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-md mb-md">
          <div class="card text-center p-md" :class="benchmarkStore.currentBenchmark.summary.failed_runs > 0 ? 'border-danger' : 'border-success'">
            <p class="text-3xl font-bold" :class="benchmarkStore.currentBenchmark.summary.failed_runs > 0 ? 'text-danger' : 'text-success'">
              {{ benchmarkStore.currentBenchmark.summary.successful_runs }} / {{ benchmarkStore.currentBenchmark.summary.total_runs }}
            </p>
            <p class="text-sm text-muted">Success Rate</p>
          </div>
          <div class="card text-center p-md">
            <p class="text-3xl font-bold text-primary">{{ formatDuration(benchmarkStore.currentBenchmark.summary.avg_duration_ms) }}</p>
            <p class="text-sm text-muted">Avg Duration</p>
          </div>
          <div class="card text-center p-md">
            <p class="text-3xl font-bold text-info">{{ formatDuration(benchmarkStore.currentBenchmark.summary.total_duration_ms) }}</p>
            <p class="text-sm text-muted">Total Time</p>
          </div>
          <div class="card text-center p-md">
            <p class="text-3xl font-bold">{{ new Date(benchmarkStore.currentBenchmark.started_at).toLocaleDateString() }}</p>
            <p class="text-sm text-muted">Date</p>
          </div>
        </div>

        <div v-if="benchmarkStore.currentBenchmark.playbooks.length > 1" class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Playbook</th>
                <th>Runs</th>
                <th>Success Rate</th>
                <th>Avg Duration</th>
                <th>Min / Max</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pb in benchmarkStore.currentBenchmark.playbooks" :key="pb.playbook">
                <td class="font-medium">{{ pb.playbook }}</td>
                <td>{{ pb.runs.length }}</td>
                <td>
                  <span :class="getSuccessRateColor(pb.success_rate)">
                    {{ (pb.success_rate * 100).toFixed(1) }}%
                  </span>
                </td>
                <td>{{ formatDuration(pb.avg_duration_ms) }}</td>
                <td class="font-mono text-sm">{{ formatDuration(pb.min_duration_ms) }} / {{ formatDuration(pb.max_duration_ms) }}</td>
                <td>
                  <button class="btn btn-ghost btn-sm" @click="showPlaybookDetails(pb)">
                    <ExternalLink size="14" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <!-- Playbook Details -->
      <Card v-for="pb in benchmarkStore.currentBenchmark.playbooks" :key="pb.playbook" class="border-l-4 border-primary">
        <template #header>
          <h3 class="card-title">{{ pb.playbook }}</h3>
        </template>
        <div class="space-y-sm">
          <div
            v-for="run in pb.runs"
            :key="run.iteration"
            class="flex items-center justify-between p-sm rounded hover:bg-bg-tertiary"
          >
            <div class="flex items-center gap-md">
              <span :class="run.success ? 'badge badge-success' : 'badge badge-danger'">
                {{ run.success ? 'Passed' : 'Failed' }}
              </span>
              <span class="font-mono text-sm">Iteration {{ run.iteration }}</span>
              <span class="text-muted">{{ formatDuration(run.duration_ms) }}</span>
            </div>
            <div v-if="run.error" class="text-danger text-sm font-mono">{{ run.error }}</div>
          </div>
        </div>
      </Card>
    </div>

    <!-- History -->
    <Card v-if="benchmarkStore.benchmarkList.length > 0">
      <template #header>
        <h3 class="card-title">Benchmark History</h3>
      </template>
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Playbooks</th>
              <th>Iterations</th>
              <th>Success Rate</th>
              <th>Avg Duration</th>
              <th>Total Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="bench in benchmarkStore.benchmarkList.slice().reverse()" :key="bench.id">
              <td class="font-mono text-xs">{{ bench.id.slice(0, 8) }}...</td>
              <td>{{ new Date(bench.started_at).toLocaleString() }}</td>
              <td>{{ bench.playbooks.map(p => p.playbook).join(', ') }}</td>
              <td>{{ bench.iterations }}</td>
              <td>
                <span :class="getSuccessRateColor(bench.summary.successful_runs / Math.max(bench.summary.total_runs, 1))">
                  {{ bench.summary.total_runs > 0 ? ((bench.summary.successful_runs / bench.summary.total_runs) * 100).toFixed(1) : 0 }}%
                </span>
              </td>
              <td>{{ formatDuration(bench.summary.avg_duration_ms) }}</td>
              <td>{{ formatDuration(bench.summary.total_duration_ms) }}</td>
              <td>
                <div class="flex items-center gap-xs">
                  <button class="btn btn-ghost btn-sm" @click="loadBenchmark(bench.id)">
                    <ExternalLink size="14" />
                  </button>
                  <button class="btn btn-ghost btn-sm" @click="benchmarkStore.clearBenchmark(bench.id)">
                    <Trash2 size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  </div>
</template>

<script>
export default {
  methods: {
    downloadResults() {
      if (this.benchmarkStore.currentBenchmark) {
        const blob = new Blob([JSON.stringify(this.benchmarkStore.currentBenchmark, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `benchmark-${this.benchmarkStore.currentBenchmark.id}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    },
    showPlaybookDetails(pb: any) {
      // Could open a modal with detailed run breakdown
      alert(`Details for ${pb.playbook} - ${pb.runs.length} runs`)
    },
    loadBenchmark(id: string) {
      this.benchmarkStore.fetchBenchmarkResult(id)
      this.currentBenchmarkId = id
      this.showResults = true
    },
  },
}
</script>

<style scoped>
.benchmarks-view {
  animation: fadeIn 0.3s ease;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.border-l-4 {
  border-left-width: 4px;
}
</style>