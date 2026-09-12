import type { Config } from 'tailwindcss';

/**
 * Design system Adaptkorpus — fiel ao brand board definitivo.
 * Fonte de verdade: cofre (obsidian) → conceitos/identidade-de-marca-adaptkorpus.
 *
 * Paleta (5 cores de marca + alerta funcional):
 *   Floresta #0D2818 — base / fundo escuro
 *   Folha    #16A34A — primária / acento em fundo CLARO
 *   Pulso    #BDFF00 — acento de evolução; SÓ em fundo ESCURO (nunca no claro)
 *   Bone     #EAE5DB — neutro / texto em fundo escuro
 *   Carvão   #0F0F0E — fundo neutro escuro
 *   Alerta   #E5484D — funcional, SÓ para sinalizar erro/mito (nunca decorativo)
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        floresta: '#0D2818',
        folha: '#16A34A',
        pulso: '#BDFF00',
        bone: '#EAE5DB',
        carvao: '#0F0F0E',
        alerta: '#E5484D',
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontWeight: {
        // Escala de pesos do brand board
        display: '800',
        titulo: '700',
        subtitulo: '500',
        corpo: '400',
        label: '600',
      },
    },
  },
  plugins: [],
};

export default config;
