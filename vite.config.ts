import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import license from 'rollup-plugin-license';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/Skjema_Endringsmeldinger/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        license({
          thirdParty: {
            output: {
              file: path.resolve(__dirname, 'dist', 'third-party-licenses.json'),
              template(dependencies) {
                return JSON.stringify(dependencies, null, 2);
              },
            },
          },
        }) as any,
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
