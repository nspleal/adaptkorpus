import LegalLayout, { Secao } from '@/components/legal/LegalLayout';

export const metadata = { title: 'Aviso (disclaimer) · Evokorpus' };

export default function Aviso() {
  return (
    <LegalLayout titulo="Aviso (disclaimer)">
      <p>Leia este aviso com atenção antes de usar o Evokorpus.</p>

      <Secao titulo="Natureza educacional">
        <p>O Evokorpus é uma ferramenta de uso geral e <strong style={{ color: '#EAE5DB' }}>caráter educacional</strong>, dirigida pelo usuário. As sugestões de treino e dieta são geradas por fórmulas a partir dos dados que você informa e de uma base de alimentos e exercícios reconhecida.</p>
      </Secao>

      <Secao titulo="Não é aconselhamento profissional">
        <p>O conteúdo <strong style={{ color: '#EAE5DB' }}>não constitui</strong> prescrição, consulta ou acompanhamento médico, nutricional ou de educação física, nem substitui a orientação de profissionais habilitados.</p>
      </Secao>

      <Secao titulo="Consulte um profissional">
        <p>Consulte um médico antes de iniciar qualquer programa de exercício ou mudança alimentar — especialmente se tiver condição de saúde, estiver gestante/amamentando, ou sentir dor. Se a triagem indicar, o app orienta procurar acompanhamento em vez de gerar um plano.</p>
      </Secao>

      <Secao titulo="Sem promessa de resultado">
        <p>Estimativas (como calorias e cargas) são <strong style={{ color: '#EAE5DB' }}>pontos de partida</strong>, não garantias. Resultados variam conforme constância, individualidade e fatores fora do controle do app. O Evokorpus não promete prazos nem desfechos.</p>
      </Secao>

      <Secao titulo="18+">
        <p>Conteúdo destinado a maiores de 18 anos.</p>
      </Secao>
    </LegalLayout>
  );
}
