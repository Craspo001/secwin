<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system'
import { useThemeStore } from '@/stores/theme'
import Sidebar from '@/components/layout/Sidebar.vue'
import TopBar from '@/components/layout/TopBar.vue'
import { onMounted } from 'vue'

const router = useRouter()
const systemStore = useSystemStore()
const themeStore = useThemeStore()

onMounted(async () => {
  await systemStore.fetchSystemInfo()
  themeStore.init()
})
</script>

<template>
  <div class="app">
    <!-- Sidebar -->
    <Sidebar :collapsed="themeStore.sidebarCollapsed" @toggle="themeStore.toggleSidebar" />

    <!-- Main Content -->
    <main class="main-content">
      <TopBar />
      <div class="page-content">
        <router-view />
      </div>
    </main>

    <!-- Mobile sidebar overlay -->
    <div
      v-if="themeStore.sidebarOpen"
      class="sidebar-overlay"
      @click="themeStore.closeSidebar"
    />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  min-height: 100vh;
  background: var(--color-bg-primary);
}

.sidebar-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: calc(var(--z-fixed) - 1);
}

@media (max-width: 1024px) {
  .sidebar-overlay {
    display: block;
  }
}
</style>