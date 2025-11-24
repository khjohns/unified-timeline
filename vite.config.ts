import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import license from 'rollup-plugin-license';

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
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              // React og core dependencies
              'vendor-react': ['react', 'react-dom', 'react-router-dom'],

              // Oslo Kommune Punkt
              'vendor-punkt': ['@oslokommune/punkt-react'],

              // PDF-relaterte biblioteker
              'vendor-pdf': ['react-pdf', 'pdfjs-dist'],
            },
          },
        },
        chunkSizeWarningLimit: 500,
        cssCodeSplit: true,
        sourcemap: false, // Deaktiver i produksjon for mindre filer
      },
      optimizeDeps: {
        include: ['@oslokommune/punkt-react', 'react-pdf', 'pdfjs-dist'],
      },
    };
});
