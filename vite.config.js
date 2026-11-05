import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, Vite hace de "servidor": agrega la API key de Tiny Plates a cada consulta.
// En producción lo hace la función api/tinyplates.js de Vercel.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ''); // lee TODAS las variables del .env (solo en Node)
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/tinyplates': {
          target: 'https://api.tinyplates.dev',
          changeOrigin: true,
          headers: { Authorization: `Bearer ${env.TINY_PLATES_API_KEY}` },
          // /api/tinyplates?path=pantry&x=1  →  /pantry?x=1
          rewrite: (p) => {
            const u = new URL(p, 'http://local');
            const path = u.searchParams.get('path');
            u.searchParams.delete('path');
            return `/${path}${u.search}`;
          },
        },
      },
    },
  };
});
