import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 配置代理
    proxy: {
      // 1. 基础代理配置（匹配以 /api 开头的请求）
      '/api': {
        target: 'http://localhost:3023', // 后端服务器地址
        changeOrigin: true, // 允许跨域（关键）
        // 可选：重写路径（如果后端接口没有 /api 前缀）
        rewrite: path => path.replace(/^\/api/, '/'),
      },
    },
  },
})
