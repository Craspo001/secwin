import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { title: 'Dashboard', icon: 'layout-dashboard' },
    },
    {
      path: '/playbooks',
      name: 'Playbooks',
      component: () => import('@/views/PlaybooksView.vue'),
      meta: { title: 'Playbooks', icon: 'book-open' },
    },
    {
      path: '/playbooks/:id',
      name: 'PlaybookDetail',
      component: () => import('@/views/PlaybookDetailView.vue'),
      meta: { title: 'Playbook Detail', hideFromNav: true },
      props: true,
    },
    {
      path: '/playbooks/:id/run',
      name: 'PlaybookRun',
      component: () => import('@/views/PlaybookRunView.vue'),
      meta: { title: 'Run Playbook', hideFromNav: true },
      props: true,
    },
    {
      path: '/playbooks/runs/:runId',
      name: 'PlaybookRunStatus',
      component: () => import('@/views/PlaybookRunStatusView.vue'),
      meta: { title: 'Run Status', hideFromNav: true },
      props: true,
    },
    {
      path: '/tools',
      name: 'Tools',
      component: () => import('@/views/ToolsView.vue'),
      meta: { title: 'Tools', icon: 'wrench' },
    },
    {
      path: '/profiles',
      name: 'Profiles',
      component: () => import('@/views/ProfilesView.vue'),
      meta: { title: 'OpSec Profiles', icon: 'shield' },
    },
    {
      path: '/evidence',
      name: 'Evidence',
      component: () => import('@/views/EvidenceView.vue'),
      meta: { title: 'Evidence Locker', icon: 'archive' },
    },
    {
      path: '/ollama',
      name: 'Ollama',
      component: () => import('@/views/OllamaView.vue'),
      meta: { title: 'AI Triage', icon: 'brain' },
    },
    {
      path: '/benchmarks',
      name: 'Benchmarks',
      component: () => import('@/views/BenchmarksView.vue'),
      meta: { title: 'Benchmarks', icon: 'bar-chart-2' },
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: 'Settings', icon: 'settings' },
    },
  ],
})

router.beforeEach((to, from, next) => {
  document.title = `SecWin - ${to.meta.title || 'Dashboard'}`
  next()
})

export default router