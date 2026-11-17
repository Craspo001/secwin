<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlaybookStore } from '@/stores/playbook'
import { Card } from '@/components/ui/Card.vue'
import { Search, Play, FileText, RefreshCw, ChevronRight } from 'lucide-vue-next'

const router = useRouter()
const playbookStore = usePlaybookStore()

const searchQuery = ref('')
const selectedPlaybook = ref<string | null>(null)

const filteredPlaybooks = computed(() => {
  if (!searchQuery.value) return playbookStore.playbooks
  const query = searchQuery.value.toLowerCase()
  return playbookStore.playbooks.filter(
    (p) =>
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.tags.some((t) => t.toLowerCase().includes(query))
  )
})

async function runPlaybook(playbook: any) {
  router.push({ name: 'PlaybookRun', params: { id: playbook.name } })
}

async function viewPlaybook(playbook: any) {
  router.push({ name: 'PlaybookDetail', params: { id: playbook.name } })
}

onMounted(async () => {
  await playbookStore.fetchPlaybooks()
})
</script>

<template>
  <div class="playbooks-view">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-md mb-xl">
      <div>
        <h1 class="text-3xl font-bold">Playbooks</h1>
        <p class="text-muted mt-xs">Manage and run security engagement playbooks</p>
      </div>
      <button class="btn btn-primary" @click="playbookStore.fetchPlaybooks" :disabled="playbookStore.loading">
        <RefreshCw size="18" :class="{ 'animate-spin': playbookStore.loading }" />
        Refresh
      </button>
    </div>

    <!-- Search -->
    <div class="mb-lg">
      <div class="relative max-w-md">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size="18" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search playbooks..."
          class="input pl-10"
        />
      </div>
    </div>

    <!-- Playbooks Grid -->
    <div v-if="playbookStore.loading" class="flex items-center justify-center py-2xl">
      <div class="animate-spin rounded-full border-4 border-primary border-t-transparent w-8 h-8" />
    </div>

    <div v-else-if="filteredPlaybooks.length === 0" class="card text-center py-2xl">
      <FileText size="48" class="text-muted mx-auto mb-md" />
      <h3 class="text-lg font-medium mb-sm">No playbooks found</h3>
      <p class="text-muted">
        {{
          searchQuery.value
            ? 'Try adjusting your search'
            : 'Create a playbook in the playbooks/ directory or run `secwin playbook init`'
        }}
      </p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
      <Card
        v-for="playbook in filteredPlaybooks"
        :key="playbook.name"
        class="flex flex-col hoverable"
        @click="viewPlaybook(playbook)"
      >
        <div class="flex items-start justify-between mb-md">
          <div class="flex-1">
            <h3 class="font-semibold text-lg">{{ playbook.name }}</h3>
            <p class="text-sm text-muted">{{ playbook.version }}</p>
          </div>
          <span class="badge badge-neutral">{{ playbook.tags.join(', ') || 'untagged' }}</span>
        </div>

        <p class="text-muted text-sm flex-1 mb-md">{{ playbook.description }}</p>

        <div class="flex items-center gap-sm mb-md" v-if="playbook.mitre_tactics.length > 0">
          <span class="text-xs text-muted">MITRE:</span>
          <span
            v-for="tactic in playbook.mitre_tactics.slice(0, 3)"
            :key="tactic"
            class="badge badge-info text-xs"
          >
            {{ tactic }}
          </span>
          <span v-if="playbook.mitre_tactics.length > 3" class="badge badge-neutral text-xs">
            +{{ playbook.mitre_tactics.length - 3 }} more
          </span>
        </div>

        <div class="flex items-center gap-sm pt-md border-t border-border-light">
          <button
            class="btn btn-primary flex-1"
            @click.stop="runPlaybook(playbook)"
          >
            <Play size="16" /> Run
          </button>
          <button
            class="btn btn-secondary"
            @click.stop="viewPlaybook(playbook)"
            title="View Details"
          >
            <FileText size="16" />
          </button>
        </div>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.playbooks-view {
  animation: fadeIn 0.3s ease;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>