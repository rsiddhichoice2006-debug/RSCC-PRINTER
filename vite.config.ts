import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';
import { handleApiRequest } from './src/server/api';

function apiServerPlugin(): Plugin {
  const middleware = async (req: any, res: any, next: any) => {
    if (req.url && (req.url.startsWith('/api/') || req.url === '/api')) {
      try {
        const handled = await handleApiRequest(req, res);
        if (handled) return;
      } catch (e) {
        console.error('API middleware error:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Server error in API middleware' }));
        return;
      }
    }
    next();
  };

  return {
    name: 'api-server-plugin',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiServerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
