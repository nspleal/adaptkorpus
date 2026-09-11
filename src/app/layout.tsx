import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import OfflineGuard from '@/components/estados/OfflineGuard';
import RegistroSW from '@/components/pwa/RegistroSW';
import AvisoPrivacidade from '@/components/AvisoPrivacidade';

// Renderização dinâmica em todas as rotas: necessária para a CSP com NONCE por requisição
// (HTML prerenderizado estático não recebe o nonce → scripts bloqueados). Ver middleware.ts.
export const dynamic = 'force-dynamic';

// Tipografia de marca — família única (brand board).
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Adaptkorpus — O corpo que não para de evoluir',
  description:
    'Treino e dieta que se adaptam a cada avanço seu. Sem planilha, sem achismo — um plano construído com você, dia após dia. Ferramenta educacional, 18+.',
  applicationName: 'Adaptkorpus',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Adaptkorpus' },
  // 🔒 iOS ignora os ícones do manifest: sem `apple-touch-icon` o atalho na tela inicial
  // usa uma CAPTURA da página. O PNG é RASTERIZADO do `icon.svg` canônico (fidelidade
  // visual do cofre — nunca redesenhar), por isso 180 px é o mesmo desenho, não outro.
  icons: { apple: '/icons/apple-touch-icon.png' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0D2818',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Analytics privado (melhoria adotada no cofre): Vercel Web Analytics é COOKIELESS
  // (hash anônimo diário no servidor — sem cookie, sem rastreio pessoal, sem dado de
  // saúde). Gated: só em produção NA Vercel (o build portátil/standalone não emite
  // beacon para um /_vercel/insights inexistente).
  const analyticsAtivo = process.env.NODE_ENV === 'production' && process.env.VERCEL === '1';
  return (
    <html lang="pt-BR" className={jakarta.variable}>
      <body className="font-sans">
        {children}
        <OfflineGuard />
        <RegistroSW />
        <AvisoPrivacidade />
        {analyticsAtivo && <Analytics />}
      </body>
    </html>
  );
}
