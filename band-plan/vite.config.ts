import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: '192.168.4.57', // Listen on specific IP address
    port: 5173,
    strictPort: true,
  },
});
