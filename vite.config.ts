import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA, type ManifestOptions } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

const manifest = {
  name: 'MyDocs',
  short_name: 'MyDocs',
  description: 'Cofre pessoal de arquivos criptografados no Google Drive',
  theme_color: '#2563eb',
  background_color: '#f8fafc',
  display: 'standalone',
  start_url: '/',
  scope: '/',
  icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  share_target: {
    action: '/share-target',
    method: 'POST',
    enctype: 'multipart/form-data',
    params: {
      title: 'title',
      text: 'text',
      url: 'url',
      files: [{ name: 'file', accept: ['image/*', 'text/*', 'application/json', 'application/xml'] }],
    },
  },
} as ManifestOptions

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest,
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
