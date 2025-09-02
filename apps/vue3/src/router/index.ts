import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/test',
      name: 'home',
      component: () => import('@/views/allFile/index.vue'), // Lazy-loaded HomeView
    },
    {
      path: '/single',
      name: 'home',
      component: () => import('@/views/file/index.vue'), // Lazy-loaded HomeView
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/uploadFiles/index.vue'), // Lazy-loaded HomeView
    },
  ],
})

export default router
