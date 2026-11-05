import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    server: {
      proxy: {
        '/api/tinyplates': {
          target: 'https://api.tinyplates.dev',
          changeOrigin: true,
          headers: {
            Authorization: `Bearer ${env.TINY_PLATES_API_KEY}`
          },
          rewrite: (p) => {
            const u = new URL(p, 'http://local');
            const path = u.searchParams.get('path');
            u.searchParams.delete('path');
            return `/${path}${u.search}`;
          },
        },

        '/api/deepl': {
          target: 'https://api-free.deepl.com',
          changeOrigin: true,
          rewrite: () => '/v2/translate',
          headers: {
            Authorization: `DeepL-Auth-Key ${env.DEEPL_API_KEY}`
          }
        }
      }
    }
  };
});