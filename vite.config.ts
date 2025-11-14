import path from 'path';
import { defineConfig } from 'vite'; // Fjernet loadEnv
import react from '@vitejs/plugin-react';
import license from 'rollup-plugin-license';

// Fjernet { mode } og env-linjen
export default defineConfig(() => {
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
      ], // <--- Denne avsluttende firkant-parentesen var sannsynligvis feilen
      
      // 'define'-blokken er fjernet
      
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
