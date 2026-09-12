/**
 * Service worker do Adaptkorpus — offline-first do PLANO DO DIA (melhoria adotada no cofre,
 * entidades/app-adaptkorpus §Melhorias: upgrade do OfflineGuard V4 de "avisar que está
 * offline" para "funcionar offline").
 *
 * Escrito à mão, sem dependências, auditável (~90 linhas). Sem precache de build (os nomes
 * dos chunks são hasheados e não são conhecíveis daqui): o critério de aceite é "um /app JÁ
 * VISITADO renderiza offline" — o cache de runtime abaixo garante isso, e os DADOS do plano
 * já vivem no localStorage (o /app recomputa o plano deterministicamente no cliente).
 *
 * Estratégias (só GET, só same-origin — API/POST/Supabase NUNCA são interceptados):
 * - /_next/static, /icons, /manifest.webmanifest → cache-first (conteúdo imutável/hasheado);
 * - navegação (modo navigate) → network-first; guardamos APENAS a rota /app (uma entrada,
 *   auditável — páginas de marketing/legais ficam fora); offline → cópia do cache.
 *
 * Nonce/CSP: o HTML cacheado e o seu header CSP vêm da MESMA resposta, então o nonce
 * confere quando reproduzido offline. Network-first renova a cópia a cada visita online.
 * Para invalidar tudo, suba a VERSAO.
 */
const VERSAO = 'v2';
const CACHE_ESTATICO = `evk-static-${VERSAO}`;
const CACHE_PAGINAS = `evk-pages-${VERSAO}`;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const manter = new Set([CACHE_ESTATICO, CACHE_PAGINAS]);
      for (const nome of await caches.keys()) {
        if (nome.startsWith('evk-') && !manter.has(nome)) await caches.delete(nome);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // nunca intercepta mutações
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // nunca intercepta terceiros (Supabase etc.)

  // Estáticos imutáveis: cache-first.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_ESTATICO);
        const hit = await cache.match(req);
        if (hit) return hit;
        const resp = await fetch(req);
        if (resp.ok) cache.put(req, resp.clone());
        return resp;
      })(),
    );
    return;
  }

  // Navegações: network-first; só a rota /app é guardada para reprodução offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const resp = await fetch(req);
          if (resp.ok && url.pathname === '/app') {
            const cache = await caches.open(CACHE_PAGINAS);
            cache.put(req, resp.clone());
          }
          return resp;
        } catch {
          const cache = await caches.open(CACHE_PAGINAS);
          const hit = (await cache.match(req)) ?? (url.pathname.startsWith('/app') ? await cache.match('/app') : null);
          if (hit) return hit;
          return new Response('Sem conexão e sem cópia salva desta página.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }
      })(),
    );
  }
});
