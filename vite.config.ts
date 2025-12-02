import path from 'path';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import license from 'rollup-plugin-license';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Plugin to remove crossorigin attribute from CSS links
// Firefox Focus (and other privacy browsers) may block CORS stylesheet requests
function removeCssCorPlugin(): Plugin {
  return {
    name: 'remove-css-crossorigin',
    enforce: 'post',
    transformIndexHtml(html) {
      // Remove crossorigin attribute from stylesheet links
      return html.replace(
        /<link rel="stylesheet" crossorigin href="/g,
        '<link rel="stylesheet" href="'
      );
    },
  };
}

export default defineConfig(({ mode }) => {
    return {
      base: mode === 'production' ? '/unified-timeline/' : '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
        watch: {
          // Ignore backend directory to prevent HMR reloads when backend files change
          ignored: ['**/backend/**', '**/koe_data/**', '**/.git/**', '**/node_modules/**'],
        },
      },
      plugins: [
        react(),
        removeCssCorPlugin(),
        viteStaticCopy({
          targets: [
            {
              src: 'node_modules/@oslokommune/punkt-assets/dist/fonts/*.woff2',
              dest: 'fonts'
            },
            {
              src: 'node_modules/@oslokommune/punkt-assets/dist/fonts/*.woff',
              dest: 'fonts'
            }
          ]
        }),
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

              // PDF-relaterte biblioteker
              'vendor-pdf': ['react-pdf', 'pdfjs-dist', '@react-pdf/renderer'],
            },
          },
        },
        chunkSizeWarningLimit: 500,
        cssCodeSplit: true,
        sourcemap: false, // Deaktiver i produksjon for mindre filer
      },
      optimizeDeps: {
        include: ['react-pdf', 'pdfjs-dist', '@react-pdf/renderer'],
      },
    };
});
