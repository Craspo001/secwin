<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useToolsStore } from '@/stores/tools'
import { Card } from '@/components/ui/Card.vue'
import { Search, Download, RefreshCw, Filter, CheckCircle, Clock, Terminal } from 'lucide-vue-next'

const toolsStore = useToolsStore()

const searchQuery = ref('')
const categoryFilter = ref('all')
const showOnlyInstalled = ref(false)

const categories = computed(() => ['all', ...new Set(toolsStore.tools.map(t => t.category))])

const filteredTools = computed(() => {
  let result = toolsStore.tools

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query)
    )
  }

  if (categoryFilter.value !== 'all') {
    result = result.filter(t => t.category === categoryFilter.value)
  }

  if (showOnlyInstalled.value) {
    result = result.filter(t => t.installed)
  }

  return result
})

async function installTool(tool: any) {
  try {
    await toolsStore.installTool(tool.name, tool.install_method)
  } catch (e) {
    console.error('Install failed:', e)
  }
}

onMounted(async () => {
  await toolsStore.fetchTools()
})
</script>

<template>
  <div class="tools-view">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-md mb-xl">
      <div>
        <h1 class="text-3xl font-bold">Tools</h1>
        <p class="text-muted mt-xs">Manage security tools from manifests</p>
      </div>
      <button class="btn btn-secondary" @click="toolsStore.fetchTools" :disabled="toolsStore.loading">
        <RefreshCw size="18" :class="{ 'animate-spin': toolsStore.loading }" />
        Refresh
      </button>
    </div>

    <!-- Filters -->
    <Card class="mb-lg">
      <div class="flex flex-col sm:flex-row gap-md">
        <div class="relative flex-1">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size="18" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search tools..."
            class="input pl-10"
          />
        </div>

        <div class="flex items-center gap-sm">
          <Filter size="18" class="text-muted" />
          <select v-model="categoryFilter" class="input input-sm select" style="width: auto;">
            <option v-for="cat in categories" :key="cat" :value="cat">
              {{ cat === 'all' ? 'All Categories' : cat }}
            </option>
          </select>
        </div>

        <label class="flex items-center gap-sm cursor-pointer">
          <input type="checkbox" v-model="showOnlyInstalled" class="w-4 h-4" />
          <span class="text-sm">Installed only</span>
        </label>
      </div>
    </Card>

    <!-- Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-md mb-lg">
      <div class="card text-center">
        <p class="text-3xl font-bold text-success">{{ toolsStore.installedTools.length }}</p>
        <p class="text-sm text-muted">Installed</p>
      </div>
      <div class="card text-center">
        <p class="text-3xl font-bold text-primary">{{ toolsStore.availableTools.length }}</p>
        <p class="text-sm text-muted">Available</p>
      </div>
      <div class="card text-center">
        <p class="text-3xl font-bold text-info">{{ toolsStore.tools.length }}</p>
        <p class="text-sm text-muted">Total</p>
      </div>
    </div>

    <!-- Tools Grid -->
    <div v-if="toolsStore.loading" class="flex items-center justify-center py-2xl">
      <div class="animate-spin rounded-full border-4 border-primary border-t-transparent w-8 h-8" />
    </div>

    <div v-else-if="filteredTools.length === 0" class="card text-center py-2xl">
      <Terminal size="48" class="text-muted mx-auto mb-md" />
      <h3 class="text-lg font-medium mb-sm">No tools found</h3>
      <p class="text-muted">
        {{ searchQuery.value || categoryFilter.value !== 'all' ? 'Try adjusting your filters' : 'No tools in manifests' }}
      </p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
      <Card
        v-for="tool in filteredTools"
        :key="tool.name"
        class="flex flex-col hoverable"
      >
        <div class="flex items-start justify-between mb-md">
          <div class="flex-1">
            <div class="flex items-center gap-sm mb-sm">
              <h3 class="font-semibold text-lg">{{ tool.name }}</h3>
              <span v-if="tool.installed" class="badge badge-success">
                <CheckCircle size="12" /> Installed
              </span>
              <span v-else class="badge badge-neutral">Not Installed</span>
            </div>
            <span class="badge badge-info text-xs">{{ tool.category }}</span>
          </div>
          <span v-if="tool.wsl_preferred" class="badge badge-warning" title="WSL Preferred">
            <Terminal size="12" />
          </span>
        </div>

        <p class="text-muted text-sm flex-1 mb-md">{{ tool.description }}</p>

        <div class="flex items-center gap-sm text-xs text-muted mb-md">
          <span v-if="tool.version" class="font-mono">{{ tool.version }}</span>
          <span v-if="tool.install_method" class="badge badge-neutral">{{ tool.install_method }}</span>
        </div>

        <div class="flex items-center gap-sm pt-md border-t border-border-light">
          <button
            v-if="!tool.installed"
            class="btn btn-primary flex-1"
            @click="installTool(tool)"
            :disabled="toolsStore.isInstalling(tool.name)"
          >
            <Download size="16" />
            {{ toolsStore.isInstalling(tool.name) ? 'Installing...' : 'Install' }}
          </button>
          <button v-else class="btn btn-secondary flex-1" disabled>
            <CheckCircle size="16" /> Installed
          </button>
        </div>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.tools-view {
  animation: fadeIn 0.3s ease;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.input-sm {
  padding: var(--space-xs) var(--space-sm);
  font-size: var(--font-size-sm);
}
</style>