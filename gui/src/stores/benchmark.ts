import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface BenchmarkRun {
  iteration: number
  duration_ms: number
  success: boolean
  error: string | null
  steps_duration: Record<string, number>
}

export interface PlaybookBenchmark {
  playbook: string
  runs: BenchmarkRun[]
  avg_duration_ms: number
  min_duration_ms: number
  max_duration_ms: number
  success_rate: number
}

export interface BenchmarkSummary {
  total_runs: number
  successful_runs: number
  failed_runs: number
  avg_duration_ms: number
  total_duration_ms: number
}

export interface BenchmarkResult {
  id: string
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  iterations: number
  playbooks: PlaybookBenchmark[]
  summary: BenchmarkSummary
}

export interface BenchmarkRequest {
  iterations: number
  playbooks: string[]
  include_install: boolean
  include_wsl: boolean
}

export const useBenchmarkStore = defineStore('benchmark', () => {
  const benchmarks = ref<Map<string, BenchmarkResult>>(new Map())
  const runningBenchmarkId = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const benchmarkList = computed(() => Array.from(benchmarks.value.values()))
  const currentBenchmark = computed(() =>
    runningBenchmarkId.value ? benchmarks.value.get(runningBenchmarkId.value) || null : null
  )

  async function startBenchmark(request: BenchmarkRequest) {
    loading.value = true
    error.value = null
    try {
      const benchmarkId = await invoke<string>('benchmark_secwin', { request })
      runningBenchmarkId.value = benchmarkId
      return benchmarkId
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to start benchmark'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchBenchmarkResult(benchmarkId: string) {
    try {
      const result = await invoke<BenchmarkResult | null>('get_benchmark_results', { benchmark_id: benchmarkId })
      if (result) {
        benchmarks.value.set(benchmarkId, result)
      }
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch benchmark results'
      console.error('Failed to fetch benchmark results:', e)
      return null
    }
  }

  function pollBenchmark(benchmarkId: string, interval = 2000) {
    const poll = async () => {
      const result = await fetchBenchmarkResult(benchmarkId)
      if (result && result.completed_at) {
        runningBenchmarkId.value = null
        return result
      }
      setTimeout(poll, interval)
    }
    poll()
  }

  function clearBenchmark(benchmarkId: string) {
    benchmarks.value.delete(benchmarkId)
  }

  function clearAllBenchmarks() {
    benchmarks.value.clear()
  }

  return {
    benchmarks,
    runningBenchmarkId,
    benchmarkList,
    currentBenchmark,
    loading,
    error,
    startBenchmark,
    fetchBenchmarkResult,
    pollBenchmark,
    clearBenchmark,
    clearAllBenchmarks,
  }
})