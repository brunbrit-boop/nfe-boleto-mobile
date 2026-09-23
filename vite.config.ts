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
            r.status = function (code: number) {
              this.statusCode = code;
              return this;
            };
            r.json = function (data: any) {
              if (!this.headersSent) {
                this.setHeader('Content-Type', 'application/json');
              }
              this.end(JSON.stringify(data));
              return this;
            };
          };

          if (req.url?.startsWith('/api/bling-token')) {
            patchResponse(res);
            const runToken = async (bodyObj: any) => {
              (req as any).body = bodyObj || {};
              try {
                await handlerToken(req as any, res as any);
              } catch (err: any) {
                if (!res.headersSent) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: err.message }));
                }
              }
            };

            if ((req as any).body !== undefined) {
              runToken((req as any).body);
              return;
            }
            if (req.method === 'GET' || req.method === 'HEAD' || req.readableEnded) {
              runToken({});
              return;
            }

            let rawBody = '';
            req.on('data', (chunk) => { rawBody += chunk; });
            req.on('end', () => {
              let parsed: any = {};
              try {
                parsed = rawBody ? JSON.parse(rawBody) : {};
              } catch {}
              runToken(parsed);
            });
            return;
          }

          if (req.url?.startsWith('/api/bling-proxy')) {
            patchResponse(res);
            const urlObj = new URL(req.url, 'http://localhost');
            (req as any).query = Object.fromEntries(urlObj.searchParams.entries());

            const runProxy = async (bodyObj: any) => {
              (req as any).body = bodyObj;
              try {
                await handlerProxy(req as any, res as any);
              } catch (err: any) {
                if (!res.headersSent) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: err.message }));
                }
              }
            };

            if ((req as any).body !== undefined) {
              runProxy((req as any).body);
              return;
            }
            if (req.method === 'GET' || req.method === 'HEAD' || req.readableEnded) {
              runProxy(undefined);
              return;
            }

            let rawBody = '';
            req.on('data', (chunk) => { rawBody += chunk; });
            req.on('end', () => {
              let parsed: any = undefined;
              try {
                parsed = rawBody ? JSON.parse(rawBody) : undefined;
              } catch {}
              runProxy(parsed);
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

