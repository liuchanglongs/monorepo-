import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/test',
      name: 'test',
      component: () => import('@/views/allFile/index.vue'), // Lazy-loaded HomeView
    },
    {
      path: '/single',
      name: 'single',
      component: () => import('@/views/file/index.vue'), // Lazy-loaded HomeView
    },
    {
      path: '/uploadFiles',
      name: 'uploadFiles',
      component: () => import('@/views/uploadFiles/index.vue'), // Lazy-loaded HomeView
    },
    {
      path: '/download',
      name: 'download',
      component: () => import('@/views/download/index.vue'), // Lazy-loaded HomeView
    },
    {
      path: '/',
      name: 'fileAPI',
      component: () => import('@/views/fileAPI/index.vue'), // Lazy-loaded HomeView
    },
  ],
})

export default router
