import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const blockBackendFilesPlugin = () => ({
  name: 'block-backend-files',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url?.toLowerCase() || '';
      if (url.includes('configdb.js') || url.includes('/server/')) {
        res.statusCode = 403;
        res.end('403 Forbidden: Access to backend configuration is blocked.');
        return;
      }
      next();
    });
  }
});

export default defineConfig({
  base: '/P4ZZ-FIREBASE-1.0/',
})
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
        fs: {
          deny: ['**/server/**', '**/ConfigDB.js']
        }
      },
      plugins: [react(), tailwindcss(), blockBackendFilesPlugin()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      }
    };
});
