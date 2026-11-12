import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = (env.VITE_BASE_PATH || '/').replace(/\/?$/, '/');
  return {
    base,
    plugins: [react()],
    server: {
      proxy: {
        [`${base}api`]: { target: env.VITE_DEV_API_PROXY || 'http://127.0.0.1:8080', rewrite: (p) => p.replace(base, '/') },
        [`${base}uploads`]: { target: env.VITE_DEV_API_PROXY || 'http://127.0.0.1:8080', rewrite: (p) => p.replace(base, '/') },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: { react: ['react', 'react-dom', 'react-router-dom'] },
        },
      },
    },
  };
});
