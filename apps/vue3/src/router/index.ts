import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    children: [
      {
        path: '/upload',
        name: 'upload',
        meta: { label: '文件上传' },
        children: [
          {
            path: '/upload/test',
            name: 'test',
            meta: { label: '测试' },
            component: () => import('@/views/allFile/index.vue'),
          },
          {
            path: '/upload/single',
            name: 'single',
            meta: { label: '单个文件' },
            component: () => import('@/views/file/index.vue'),
          },
          {
            path: '/upload/mutilation',
            name: 'mutilation',
            meta: { label: '多个文件' },
            component: () => import('@/views/uploadFiles/index.vue'),
          },
        ],
      },
      {
        path: '/download',
        name: 'download',
        meta: { label: '文件下载' },
        children: [
          {
            path: '/download/fileAPI',
            name: 'fileAPI',
            meta: { label: '文件系统' },
            component: () => import('@/views/fileAPI/index.vue'),
          },
          {
            path: '/download/Blob',
            name: 'Blob',
            meta: { label: 'Blob下载' },
            component: () => import('@/views/download/Blob.vue'),
          },
          {
            path: '/download/streamSaver',
            name: 'streamSaver',
            meta: { label: 'streamSaver下载' },
            component: () => import('@/views/download/streamSaver.vue'),
          },
          {
            path: '/download/useFileAPI',
            name: 'useFileAPI',
            meta: { label: '使用FileAPI下载' },
            component: () => import('@/views/download/index.vue'),
          },
        ],
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
