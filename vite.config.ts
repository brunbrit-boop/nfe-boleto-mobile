import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import handlerToken from './api/bling-token.js'
import handlerProxy from './api/bling-proxy.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-api-endpoints',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          // Monkey-patch compatível com Vercel Serverless Function
          const patchResponse = (r: any) => {
            if (!r.status) {
              r.status = function (code: number) {
                this.statusCode = code;
                return this;
              };
            }
            if (!r.json) {
              r.json = function (data: any) {
                this.setHeader('Content-Type', 'application/json');
                this.end(JSON.stringify(data));
                return this;
              };
            }
          };

          if (req.url?.startsWith('/api/bling-token')) {
            patchResponse(res);
            let rawBody = '';
            req.on('data', (chunk) => { rawBody += chunk; });
            req.on('end', async () => {
              try {
                (req as any).body = rawBody ? JSON.parse(rawBody) : {};
              } catch {
                (req as any).body = {};
              }
              try {
                await handlerToken(req as any, res as any);
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }

          if (req.url?.startsWith('/api/bling-proxy')) {
            patchResponse(res);
            const urlObj = new URL(req.url, 'http://localhost');
            (req as any).query = Object.fromEntries(urlObj.searchParams.entries());
            let rawBody = '';
            req.on('data', (chunk) => { rawBody += chunk; });
            req.on('end', async () => {
              try {
                (req as any).body = rawBody ? JSON.parse(rawBody) : undefined;
              } catch {
                (req as any).body = undefined;
              }
              try {
                await handlerProxy(req as any, res as any);
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }

          next();
        });
      },
    },
  ],
  server: {
    proxy: {
      '/api': {
        target: 'https://nfe-boleto-mobile.vercel.app',
        changeOrigin: true,
      },
    },
  },
})

