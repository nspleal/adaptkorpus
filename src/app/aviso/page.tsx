import LegalLayout from '@/components/legal/LegalLayout';
import { SecaoLegal, Paragrafo, Lista, ItemLista, Forte, DISCLAIMER } from '@/components/legal/ui';

export const metadata = { title: 'Aviso · Adaptkorpus' };

const TOC = [
  { id: 's-aviso', label: 'O aviso' },
  { id: 's-seguranca', label: 'Segurança e saúde' },
  { id: 's-limites', label: 'Limites da ferramenta' },
];

export default function Aviso() {
  return (
    <LegalLayout page="aviso" titulo="Aviso" subtitulo="Leia antes de começar." toc={TOC}>
      <section id="s-aviso" data-toc-target style={{ margin: '0 0 40px', scrollMarginTop: 128 }}>
        <div style={{ position: 'relative', background: 'linear-gradient(165deg, rgba(229,72,77,.07), rgba(15,15,14,.5))', border: '1px solid rgba(229,72,77,.32)', borderRadius: 22, padding: 'clamp(26px,4vw,40px)', animation: `evkPop .4s cubic-bezier(.22,.61,.36,1)` }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, color: '#E5484D', fontSize: '.78rem', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 18 }}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none"><path d="M12 3l9 16H3l9-16z" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" /><path d="M12 10v4M12 17.5v.01" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></svg>
            Leia antes de começar
          </div>
          <p style={{ margin: 0, fontSize: 'clamp(1.16rem,2vw,1.42rem)', lineHeight: 1.6, fontWeight: 600, color: '#EAE5DB', letterSpacing: '-.01em' }}>{DISCLAIMER}</p>
        </div>
      </section>

      <SecaoLegal id="s-seguranca" titulo="Segurança e saúde">
        <Paragrafo mb>Sua segurança vem antes de qualquer plano.</Paragrafo>
        <Lista>
          <ItemLista>Sentiu <Forte>dor</Forte> (diferente do cansaço normal)? Pare o exercício e procure um profissional.</ItemLista>
          <ItemLista>Tem alguma condição de saúde, está gestante ou em recuperação? Converse com seu médico antes.</ItemLista>
          <ItemLista ultimo>O app não incentiva treinar com dor nem “compensar” exageros.</ItemLista>
        </Lista>
      </SecaoLegal>

      <SecaoLegal id="s-limites" titulo="Limites da ferramenta" ultima>
        <Paragrafo mb>O Adaptkorpus <Forte>não promete resultado, número ou prazo</Forte>. As estimativas de calorias e cargas são <Forte>pontos de partida</Forte>, não metas exatas — você ajusta conforme a sua realidade.</Paragrafo>
        <Paragrafo>Para dúvidas clínicas, nutricionais ou de treino específicas do seu caso, procure profissionais habilitados.</Paragrafo>
      </SecaoLegal>
    </LegalLayout>
  );
}
