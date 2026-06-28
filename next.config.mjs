/**
 * Configuração do Next.js — App Evokorpus.
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

/** @type {string} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

/** Deriva a origem (scheme://host) do Supabase para liberar em connect-src. */
function supabaseOrigin() {
  if (!supabaseUrl) return '';
  try {
    return new URL(supabaseUrl).origin;
  } catch {
    return '';
  }
}

const origin = supabaseOrigin();
const wsOrigin = origin ? origin.replace(/^http/, 'ws') : '';

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  // 'unsafe-inline' em script só vale em dev (HMR). Em produção, ver hardening por nonce.
  process.env.NODE_ENV === 'development'
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self'",
  `connect-src 'self' ${origin} ${wsOrigin}`.trim(),
  'upgrade-insecure-requests',
]
  .filter(Boolean)
  .join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
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
