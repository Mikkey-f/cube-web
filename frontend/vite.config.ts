import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        // 大依赖拆分为独立 chunk：three 只在首页用到，
        // 拆分后登录/注册等页面首屏不必加载，缓存命中率也更高
        manualChunks: {
          three: ['three'],
          motion: ['framer-motion'],
          vendor: ['react', 'react-dom', 'react-router-dom']
        }
      }
    }
  }
})
