  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';

  // ✅ Configuración universal (dev + prod)
  export default defineConfig({
    plugins: [react()],
    server: {
      port: 5173, // puerto donde corre Vite en desarrollo
      proxy: {
        // 🔹 Todas las peticiones que empiecen con /api irán al backend
        '/api': {
          target: 'http://localhost:3001', // backend en desarrollo
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: 'dist', // carpeta de compilación
    },
  });