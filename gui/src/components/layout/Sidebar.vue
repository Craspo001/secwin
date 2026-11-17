<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import {
  LayoutDashboard,
  BookOpen,
  Wrench,
  Shield,
  Archive,
  Brain,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const themeStore = useThemeStore()

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/playbooks', label: 'Playbooks', icon: BookOpen },
  { path: '/tools', label: 'Tools', icon: Wrench },
  { path: '/profiles', label: 'OpSec Profiles', icon: Shield },
  { path: '/evidence', label: 'Evidence Locker', icon: Archive },
  { path: '/ollama', label: 'AI Triage', icon: Brain },
  { path: '/benchmarks', label: 'Benchmarks', icon: BarChart2 },
  { path: '/settings', label: 'Settings', icon: Settings },
]

function isActive(path: string) {
  return route.path.startsWith(path)
}
</script>

<template>
  <aside
    class="sidebar"
    :class="{ collapsed: themeStore.sidebarCollapsed, open: themeStore.sidebarOpen }"
  >
    <!-- Header -->
    <div class="sidebar-header">
      <div class="flex items-center gap-sm">
        <div class="avatar" style="background: var(--color-brand-primary);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
        </div>
        <div v-if="!themeStore.sidebarCollapsed" class="flex flex-col">
          <span class="font-semibold text-lg">SecWin</span>
          <span class="text-xs text-muted">Modern Kali Tooling</span>
        </div>
      </div>
      <button
        class="btn-ghost btn-sm"
        @click="themeStore.toggleSidebar"
        :aria-label="themeStore.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      >
        <ChevronLeft v-if="!themeStore.sidebarCollapsed" size="18" />
        <ChevronRight v-else size="18" />
      </button>
    </div>

    <!-- Navigation -->
    <nav class="sidebar-nav" aria-label="Main navigation">
      <ul role="list">
        <li v-for="item in navItems" :key="item.path">
          <router-link
            :to="item.path"
            class="nav-item"
            :class="{ active: isActive(item.path) }"
            @click="themeStore.closeSidebar"
          >
            <component :is="item.icon" size="20" aria-hidden="true" />
            <span v-if="!themeStore.sidebarCollapsed">{{ item.label }}</span>
          </router-link>
        </li>
      </ul>
    </nav>

    <!-- Footer -->
    <div class="sidebar-footer" v-if="!themeStore.sidebarCollapsed">
      <div class="text-xs text-muted text-center">
        SecWin v1.0.0
      </div>
    </div>
  </aside>

  <!-- Mobile toggle button -->
  <button
    v-show="themeStore.sidebarOpen"
    class="mobile-menu-btn fixed top-4 left-4 z-50 btn-primary rounded-full shadow-lg"
    @click="themeStore.closeSidebar"
    aria-label="Close sidebar"
  >
    <X size="20" />
  </button>
</template>

<style scoped>
.sidebar {
  transition: transform var(--transition-base), width var(--transition-base);
}

.sidebar.collapsed {
  width: 72px;
}

.sidebar.collapsed .sidebar-header .flex-col,
.sidebar.collapsed .nav-item span,
.sidebar.collapsed .sidebar-footer {
  display: none;
}

.sidebar.collapsed .nav-item {
  justify-content: center;
  padding: var(--space-sm);
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 64px;
}

.nav-item {
  display: flex;
  align-items: center;
}

.sidebar-footer {
  margin-top: auto;
}
</style>