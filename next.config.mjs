/**
 * Configuração do Next.js — App Adaptkorpus.
 *
 * Segurança em primeira classe: cabeçalhos de segurança aplicados a TODAS as rotas.
 * A Content-Security-Policy inclui o host do Supabase (lido do ambiente em build) em
 * connect-src, para que o app só consiga falar com o backend autorizado.
 *
 * Nota de honestidade: `style-src 'unsafe-inline'` é necessário hoje por causa dos
 * estilos inline do Next/Tailwind. O endurecimento para CSP com nonce por requisição
 * (script-src/style-src com nonce, sem 'unsafe-inline') está documentado como próximo
 * passo em docs/security-lgpd.md.
 */

// A Content-Security-Policy é definida no middleware (com nonce por requisição), porque o
// App Router precisa assinar seus scripts inline — ver src/middleware.ts. Aqui ficam só os
// headers estáticos de segurança.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Servidor auto-contido para o pacote portátil (Node embutido) — ver
  // .github/workflows/portable-windows.yml. Não afeta dev nem deploy na Vercel.
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
