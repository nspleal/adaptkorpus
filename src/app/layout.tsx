import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

// Tipografia de marca — família única (brand board).
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Evokorpus — O corpo que não para de evoluir',
  description:
    'Treino e dieta que se adaptam a cada avanço seu. Sem planilha, sem achismo — um plano construído com você, dia após dia. Ferramenta educacional, 18+.',
  applicationName: 'Evokorpus',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Evokorpus' },
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
  return (
    <html lang="pt-BR" className={jakarta.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
