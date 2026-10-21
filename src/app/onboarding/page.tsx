'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { gerarDieta, type ResultadoMotor } from '@/lib/engine';
import type { NivelAtividade, NivelExperiencia, Objetivo, PerfilUsuario, Sexo } from '@/lib/engine';
import type { EquipamentoCasa, Alergeno, EquipamentoDisp } from '@/lib/data/types';
import { FOODS_BY_ID_SEED, RECIPES_SEED } from '@/lib/data/seed';
import { consentimentoSchema, perfilSchema } from '@/lib/validation/profile';
import { type PerfilResumo } from '@/components/painel/Painel';
import { lerSessao, lerSessaoCompleta, salvarSessao } from '@/lib/session';
import { carregarPerfilServidor } from '@/lib/persistencia/sync';
import { carregarFonteCorrecao, mesclarPerfilCorrigido, persistirCorrecao, type FonteCorrecao } from '@/lib/persistencia/recuperacao-perfil';
import { supabaseConfigurado } from '@/lib/supabase/env';
import { ROTULOS_CAMPOS_PERFIL } from '@/lib/validation/perfil-resumo';
import { registrarEvento } from '@/lib/metricas/registrar';
import { resolverEscopoLocal } from '@/lib/escopo-local';
import { salvarPerfilServidor } from '@/lib/persistencia/sync';
import { diasPadrao, ORDEM_SEMANA, type Weekday } from '@/lib/semana';
import { ChecklistEquipamento, SeletorDias, PreferenciasAlimentares } from '@/components/perfil/DiasEPreferencias';
import { LinhaConsentimento, LinkLegal } from '@/components/auth/ui';

/**
 * Onboarding (área logada) — porte FIEL do protótipo (Adaptkorpus App.dc.html):
 * stepper com pontos ascendentes + barra com glow, card em gradiente, evkStepIn por
 * passo, estilos exatos de cada opção. Ligado ao motor real (gate A/B/C + Painel).
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';
const TOTAL = 8;

// estilos exatos do protótipo
const cardBase: CSSProperties = { cursor: 'pointer', position: 'relative', background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.12)', borderRadius: 16, padding: '18px 20px', transition: `transform .3s ${EASE},border-color .3s ease,background .3s ease,box-shadow .3s ease` };
const cardSel: CSSProperties = { borderColor: '#BDFF00', background: 'rgba(189,255,0,.07)', boxShadow: '0 0 0 1px rgba(189,255,0,.35)' };
const segBase: CSSProperties = { cursor: 'pointer', flex: 1, minWidth: 0, textAlign: 'center', padding: '13px 8px', borderRadius: 12, fontWeight: 600, fontSize: '.95rem', transition: 'all .25s ease', border: '1px solid rgba(234,229,219,.12)', background: 'rgba(234,229,219,.04)', color: 'rgba(234,229,219,.7)' };
const segSel: CSSProperties = { borderColor: '#BDFF00', background: 'rgba(189,255,0,.1)', color: '#BDFF00' };
const labelCap: CSSProperties = { fontSize: '.8rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 10 };
const inputBox: CSSProperties = { display: 'flex', alignItems: 'center', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 12, padding: '0 14px' };
const inputInner: CSSProperties = { width: '100%', background: 'none', border: 'none', color: '#EAE5DB', fontSize: '1.1rem', fontWeight: 600, padding: '13px 0', outline: 'none' };
const h2: CSSProperties = { margin: '0 0 22px', fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-.02em' };

const ATIVIDADES: { id: NivelAtividade; t: string; d: string }[] = [
  { id: 'sedentario', t: 'Sedentário', d: 'Pouco ou nenhum exercício' },
  { id: 'leve', t: 'Leve', d: '1–2 dias por semana' },
  { id: 'moderado', t: 'Moderado', d: '3–4 dias por semana' },
  { id: 'intenso', t: 'Intenso', d: '5–6 dias por semana' },
  { id: 'muito_intenso', t: 'Muito intenso', d: 'Treino diário / trabalho físico' },
];
const OBJETIVOS: { id: Objetivo; t: string; d: string }[] = [
  { id: 'emagrecimento', t: 'Emagrecer', d: 'Reduzir gordura com constância.' },
  { id: 'massa', t: 'Ganhar massa', d: 'Construir músculo de forma estruturada.' },
  { id: 'saude', t: 'Manter / Saúde', d: 'Manutenção e bem-estar no longo prazo.' },
];
const EXPERIENCIAS: { id: NivelExperiencia; t: string; d: string }[] = [
  { id: 'iniciante', t: 'Iniciante', d: 'Começando agora ou voltando.' },
  { id: 'intermediario', t: 'Intermediário', d: 'Treino há alguns meses.' },
  { id: 'avancado', t: 'Avançado', d: 'Treino consistente há anos.' },
];
// Modelo 2 NÍVEIS (DF 2026-07-04): Casa (com checklist do que você tem) ou Academia.
const LOCAIS: { id: EquipamentoDisp; t: string; d: string }[] = [
  { id: 'casa', t: 'Em casa', d: 'Marque abaixo o que você tem — ou nada: só o peso do corpo também funciona.' },
  { id: 'academia', t: 'Academia', d: 'Equipamento completo.' },
];
const PADROES: { id: '' | 'vegetariano' | 'vegano'; t: string; d: string }[] = [
  { id: '', t: 'Onívoro', d: 'Como de tudo' },
  { id: 'vegetariano', t: 'Vegetariano', d: 'Sem carne' },
  { id: 'vegano', t: 'Vegano', d: 'Sem origem animal' },
];
const HEALTH: { id: string; q: string; fem?: boolean }[] = [
  { id: 'gestante', q: 'Está gestante ou amamentando?', fem: true },
  { id: 'renal', q: 'Tem alguma condição renal?' },
  { id: 'cardiaca', q: 'Tem alguma condição cardíaca?' },
  { id: 'lesao', q: 'Tem lesão ou limitação física?' },
  { id: 'diabetes', q: 'Tem diabetes?' },
];

const ETAPA_DO_CAMPO: Record<string, number> = {
  sexo: 1, idade: 1, alturaCm: 1, pesoKg: 1, flagsSaude: 2, objetivo: 3,
  nivelAtividade: 4, nivelExperiencia: 5, equipamento: 6, tempoPorSessaoMin: 6,
  treinoDias: 6, diasDisponiveis: 6, alergenos: 7, preferencia: 7,
};

type Fase = 'wizard' | 'gerando' | 'resultado';
type SimNaoV = 'sim' | 'nao';

export default function Onboarding() {
  const router = useRouter();
  // Já tem sessão? O cadastro de perfil é só da 1ª vez — manda direto pra área logada
  // (edições posteriores são só pela aba "Editar perfil"). Evita reabrir o wizard no reload/voltar.
  const [checando, setChecando] = useState(true);
  /**
   * 🔴 D11 (auditoria 2026-09-11) — MODO CORREÇÃO (`/onboarding?corrigir=1`).
   *
   * Sem ele, a recuperação do perfil ilegível seria outro laço: `/app` mandaria a pessoa para
   * cá e o guard acima a mandaria de volta para `/app`. Aqui o questionário reescreve os
   * ESCALARES e o resto do perfil é PRESERVADO na mesclagem — inclusive `rotinaCustom`, o
   * treino que a pessoa montou à mão, que o `resumo` do wizard não carrega.
   *
   * ⚠️ `window.location.search` em vez de `useSearchParams`: a leitura acontece dentro do
   * efeito (cliente), e assim a página não passa a exigir uma fronteira de Suspense no build.
   */
  const [modoCorrecao, setModoCorrecao] = useState(false);
  const perfilPreservado = useRef<PerfilResumo | null>(null);
  const fonteCorrecao = useRef<FonteCorrecao | null>(null);
  const [erroLeitura, setErroLeitura] = useState(false);
  const [camposAConfirmar, setCamposAConfirmar] = useState<string[]>([]);
  useEffect(() => {
    // 🔒 Escopo primeiro (ver `escopo-local.ts`): sem ele, `lerSessao` leria a chave sem
    // sufixo — que pode ser de outra conta que usou este navegador.
    let vivo = true;
    void resolverEscopoLocal().then(async () => {
      const corrigindo = new URLSearchParams(window.location.search).get('corrigir') === '1';
      if (corrigindo) {
        setModoCorrecao(true);
        const fonte = await carregarFonteCorrecao(lerSessaoCompleta(), supabaseConfigurado(), carregarPerfilServidor);
        if (!vivo) return;
        if (!fonte) { setErroLeitura(true); setChecando(false); return; }
        fonteCorrecao.current = fonte;
        perfilPreservado.current = fonte.perfil;
        setCamposAConfirmar(fonte.perfil.camposInvalidos ?? []);
        preencherComOQueFoiLido(fonte.perfil);
      } else if (lerSessao()) {
        // 🔴 D11 — o ÚNICO caso em que ter sessão não devolve a pessoa para `/app`: ela veio
        // de lá porque o perfil não pôde ser lido. Mandá-la de volta seria o laço outra vez.
        if (!corrigindo) { router.replace('/app'); return; }
      }
      setChecando(false);
    }).catch(() => { if (vivo) { setErroLeitura(true); setChecando(false); } });
    return () => { vivo = false; };
    // Só no mount: reabrir este efeito sobrescreveria o que a pessoa já digitou.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const [terms, setTerms] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [sexo, setSexo] = useState<Sexo>('feminino');
  const [idade, setIdade] = useState('30');
  const [altura, setAltura] = useState('170');
  const [peso, setPeso] = useState('70');
  const [healthAns, setHealthAns] = useState<Record<string, SimNaoV>>({});
  const [objetivo, setObjetivo] = useState<Objetivo>('emagrecimento');
  const [atividade, setAtividade] = useState<NivelAtividade>('moderado');
  const [experiencia, setExperiencia] = useState<NivelExperiencia>('iniciante');
  const [local, setLocal] = useState<EquipamentoDisp>('casa');
  const [equipsCasa, setEquipsCasa] = useState<EquipamentoCasa[]>([]);
  const toggleEquip = (eq: EquipamentoCasa) => setEquipsCasa((p) => (p.includes(eq) ? p.filter((x) => x !== eq) : [...p, eq]));
  const [treinoDias, setTreinoDias] = useState<Weekday[]>(diasPadrao(3));
  const [tempo, setTempo] = useState(45);
  const [limiteTempoTreino, setLimiteTempoTreino] = useState<PerfilResumo['limiteTempoTreino']>();
  const escolherTempo = (t: number) => { setTempo(t); setLimiteTempoTreino(t === 75 ? 'sem_limite' : 'limitado'); };
  const [padrao, setPadrao] = useState<'' | 'vegetariano' | 'vegano'>('');
  // 💰 Orçamento no funil: OPCIONAL, default "sem preferência" (= `alto` no motor). Nenhum
  // campo obrigatório novo — `canCont()` não olha para isto.
  const [orcamento, setOrcamento] = useState<'baixo' | 'medio' | 'alto' | null>(null);
  const [alergias, setAlergias] = useState<Alergeno[]>([]);
  const [naoCurto, setNaoCurto] = useState<string[]>([]);
  const toggleDia = (w: Weekday) => setTreinoDias((p) => (p.includes(w) ? p.filter((x) => x !== w) : [...p, w].sort((a, b) => ORDEM_SEMANA.indexOf(a) - ORDEM_SEMANA.indexOf(b))));
  const addFood = (id: string) => setNaoCurto((p) => (p.includes(id) ? p : [...p, id]));
  const removeFood = (id: string) => setNaoCurto((p) => p.filter((x) => x !== id));

  /**
   * 🔒 D11 — só o que FOI LIDO volta para a tela. Campo marcado em `camposInvalidos` fica com
   * o default do wizard, para a pessoa escolher de novo: pré-preencher um campo ilegível
   * seria mostrar como escolha dela um valor que o app não conseguiu ler.
   */
  function preencherComOQueFoiLido(p: PerfilResumo) {
    const ilegivel = new Set(p.camposInvalidos ?? []);
    const ok = (campo: string) => !ilegivel.has(campo);
    if (ok('sexo')) setSexo(p.sexo);
    if (ok('idade')) setIdade(String(p.idade));
    else setIdade('');
    if (ok('alturaCm')) setAltura(String(p.alturaCm));
    else setAltura('');
    if (ok('pesoKg')) setPeso(String(p.pesoKg));
    else setPeso('');
    if (ok('objetivo')) setObjetivo(p.objetivo);
    if (ok('nivelAtividade')) setAtividade(p.nivelAtividade);
    if (ok('nivelExperiencia')) setExperiencia(p.nivelExperiencia);
    if (ok('equipamento')) setLocal(p.equipamento === 'academia' ? 'academia' : 'casa');
    if (ok('equipamentosCasa') && p.equipamentosCasa) setEquipsCasa([...p.equipamentosCasa]);
    if (ok('treinoDias') && p.treinoDias?.length) setTreinoDias([...p.treinoDias]);
    if (ok('tempoPorSessaoMin')) { setTempo(p.tempoPorSessaoMin); setLimiteTempoTreino(p.limiteTempoTreino); }
    if (ok('preferencia')) setPadrao(p.preferencia ?? '');
    if (p.orcamento != null) setOrcamento(p.orcamento);
    if (ok('alergenos')) setAlergias([...p.alergenos]);
    setNaoCurto([...(p.naoCurto ?? [])]);
    if (ok('flagsSaude')) {
      const f = p.flagsSaude;
      setHealthAns({
        gestante: f.gestacaoAmamentacao ? 'sim' : 'nao', renal: f.renal ? 'sim' : 'nao',
        cardiaca: f.cardiaca ? 'sim' : 'nao', lesao: f.lesao ? 'sim' : 'nao',
        diabetes: f.diabetes ? 'sim' : 'nao',
      });
    }
  }

  const [step, setStep] = useState(0);
  const [fase, setFase] = useState<Fase>('wizard');
  const [erro, setErro] = useState('');
  const [genPct, setGenPct] = useState(0);

  const [dieta, setDieta] = useState<ResultadoMotor | null>(null); // mantido só para o Gate B (ROTEAR)
  const giRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (giRef.current) clearInterval(giRef.current); }, []);

  const toggleAlergia = (a: Alergeno) => setAlergias((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]));
  const setHealth = (id: string, v: SimNaoV) => setHealthAns((p) => ({ ...p, [id]: v }));
  const reqHealth = HEALTH.filter((q) => !q.fem || sexo === 'feminino');

  function canCont(): boolean {
    if (camposAConfirmar.some((c) => ETAPA_DO_CAMPO[c] === step)) return false;
    if (step === 0) return terms.every(Boolean);
    if (step === 1) { const i = +idade, a = +altura, p = +peso; return i >= 18 && i <= 100 && a >= 100 && a <= 250 && p >= 30 && p <= 300; }
    if (step === 2) return reqHealth.every((q) => healthAns[q.id]);
    if (step === 6) return treinoDias.length >= 1; // ao menos um dia de treino
    return true;
  }

  function continuar() {
    setErro('');
    if (!canCont()) return;
    if (step === TOTAL - 1) gerar();
    else { setStep((s) => s + 1); window.scrollTo(0, 0); }
  }
  const voltar = () => { setErro(''); setStep((s) => Math.max(0, s - 1)); window.scrollTo(0, 0); };

  function gerar() {
    const flags = {
      gestacaoAmamentacao: healthAns.gestante === 'sim', renal: healthAns.renal === 'sim',
      cardiaca: healthAns.cardiaca === 'sim', lesao: healthAns.lesao === 'sim', diabetes: healthAns.diabetes === 'sim',
    };
    const consent = consentimentoSchema.safeParse({ aceite18: terms[0], aceiteTermos: terms[1], aceiteLgpd: terms[2] });
    const parse = perfilSchema.safeParse({ sexo, pesoKg: peso, alturaCm: altura, idade, nivelAtividade: atividade, objetivo, flagsSaude: flags, preferenciaAlimentar: padrao || null, alergenos: alergias });
    if (!consent.success || !parse.success) { setErro('Confira seus dados antes de gerar.'); return; }
    const p = parse.data;
    const restricoes = { alergenos: p.alergenos as Alergeno[], preferencia: p.preferenciaAlimentar ?? null, excluirAlimentoIds: naoCurto, orcamento };
    const perfil: PerfilUsuario = { sexo: p.sexo, pesoKg: p.pesoKg, alturaCm: p.alturaCm, idade: p.idade, nivelAtividade: p.nivelAtividade, objetivo: p.objetivo, flagsSaude: p.flagsSaude };
    const d = gerarDieta(perfil, { recipes: RECIPES_SEED, foodsById: FOODS_BY_ID_SEED, restricoes });
    const doWizard: PerfilResumo = { sexo: p.sexo, idade: p.idade, alturaCm: p.alturaCm, pesoKg: p.pesoKg, objetivo: p.objetivo, nivelAtividade: p.nivelAtividade, nivelExperiencia: experiencia, equipamento: local, preferencia: p.preferenciaAlimentar ?? null, alergenos: p.alergenos as Alergeno[], orcamento, diasDisponiveis: treinoDias.length, tempoPorSessaoMin: tempo, limiteTempoTreino, treinoDias, naoCurto, pratosCansados: [], flagsSaude: p.flagsSaude, equipamentosCasa: local === 'casa' ? equipsCasa : [] };
    /**
     * 🔒 D11 — MODO CORREÇÃO: o que se grava é o perfil ANTERIOR com os escalares reescritos
     * por cima. Gravar só o que o wizard coleta apagaria `rotinaCustom`, `preferencias`,
     * `foco`, `favoritos` e a âncora do mesociclo — nada disso passa pelo questionário.
     * Fora da correção, `resumo` é exatamente o que sempre foi.
     */
    const anterior = perfilPreservado.current;
    const resumo: PerfilResumo = anterior
      ? mesclarPerfilCorrigido(anterior, doWizard)
      : doWizard;
    setDieta(d);

    setFase('gerando'); setGenPct(0); window.scrollTo(0, 0);
    let pct = 0;
    if (giRef.current) clearInterval(giRef.current);
    giRef.current = setInterval(() => {
      pct = Math.min(100, pct + 9);
      setGenPct(pct);
      if (pct >= 100) {
        if (giRef.current) clearInterval(giRef.current);
        setTimeout(async () => {
          // A correção só troca o cache e navega após confirmação remota.
          let entradaCorrigida = fonteCorrecao.current?.entradaPlano;
          if (anterior && fonteCorrecao.current) {
            const consent = { aceite18: terms[0], aceiteTermos: terms[1], aceiteLgpd: terms[2] };
            const resultado = await persistirCorrecao(fonteCorrecao.current, resumo, consent, salvarPerfilServidor);
            if (!resultado.ok) { setErro(resultado.mensagem); setFase('wizard'); return; }
            entradaCorrigida = resultado.entradaPlano;
          }
          // Antes de deixar o formulário, cadastro e consentimentos precisam estar duráveis.
          if (!anterior && supabaseConfigurado()) {
            const consent = { aceite18: terms[0], aceiteTermos: terms[1], aceiteLgpd: terms[2] };
            const gravado = await salvarPerfilServidor(resumo, 0, undefined, consent, { aguardarConfirmacao: false });
            if (gravado.tipo === 'FALHA') {
              setErro('Não foi possível guardar o cadastro neste aparelho. Seus campos continuam aqui; tente novamente.');
              setFase('wizard'); return;
            }
          }
          // 🔒 Cofre, DF 2026-07-27 ("`ROTEAR` = MODO DIÁRIO"): TODO desfecho cria sessão e
          // perfil — inclusive o Gate B. Antes o ROTEAR não criava nada, e a pessoa ficava
          // presa na porta: era por isso que ela não entrava. O que o roteado não recebe é
          // PRESCRIÇÃO, e quem tira o plano da tela é o `modoDiario` do painel — não a
          // ausência de conta.
          // 🔒 `plano_gerado` sai QUANDO o plano é gerado — é o denominador do abandono
          // (o caso do beta: 4 de 5 contas geraram plano e nunca voltaram). ⚠️ Nada de
          // saúde no payload: sai o retrato declarado, não a resposta do gate.
          // ⚠️ ANTES do `salvarSessao`, de propósito: colocado depois, este bloco afastava
          // `salvarSessao(resumo)` do check de ROTEAR além da janela do guard da Leva 2 que
          // prova que a porta do modo diário está aberta. O guard existente não se afrouxa
          // para caber código novo — o código novo é que sai da frente.
          registrarEvento('plano_gerado', {
            plano_id: `${resumo.objetivo}-${resumo.nivelExperiencia}-${resumo.diasDisponiveis}`,
            objetivo: resumo.objetivo,
            nivel: resumo.nivelExperiencia,
            local: resumo.equipamento,
            dias_declarados: resumo.diasDisponiveis,
          });
          salvarSessao(resumo, entradaCorrigida);
          // No backend, a outbox já confirmou o commit local; /app exibe a pendência até ACK.
          // Gate B → encaminhamento, com a porta do diário aberta. Desfecho A/C → direto.
          if (d.gate.comportamento === 'ROTEAR') setFase('resultado');
          else router.replace('/app');
        }, 450);
      }
    }, 150);
  }

  const recomecar = () => { setFase('wizard'); setStep(0); setDieta(null); };

  // Enquanto checa a sessão (evita piscar o wizard antes do redirect para /app).
  if (checando) return <div style={{ minHeight: '100vh', background: '#0D2818' }} />;
  if (erroLeitura) return (
    <main style={{ padding: 24, maxWidth: 620, margin: 'auto' }}>
      <h1>Não conseguimos carregar seu perfil para correção</h1>
      <p role="alert">Nenhum dado foi substituído. Confira sua conexão e tente carregar novamente.</p>
      <button onClick={() => window.location.reload()}>Carregar novamente</button>
    </main>
  );

  return (
    <div style={{ position: 'relative', minHeight: '100vh', width: '100%', overflowX: 'hidden', background: '#0D2818', color: '#EAE5DB' }}>
      <Backdrop />

      {fase === 'wizard' && (
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px 56px', animation: `evkScreenIn .5s ${EASE}` }}>
          <div style={{ width: '100%', maxWidth: 620 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 30 }}><Logo size={26} /><Marca size="1.05rem" /></div>
            {modoCorrecao && (
              <p role="status" style={{ margin: '0 0 22px', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(234,179,8,.45)', background: 'rgba(234,179,8,.08)', fontSize: '.9rem', lineHeight: 1.55, color: 'rgba(234,229,219,.85)' }}>
                Estamos <strong>conferindo seus dados</strong>. O que pôde ser lido já está preenchido; confirme ou corrija e seu
                plano volta. Seu treino montado e suas preferências continuam salvos.
              </p>
            )}

            {/* stepper */}
            <div style={{ marginBottom: 30 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 11 }}>
                <span style={{ fontSize: '.78rem', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)' }}>Passo {step + 1} de {TOTAL}</span>
                <svg width={56} height={22} viewBox="0 0 56 22" fill="none"><path d="M4 18 Q22 14 34 8 T52 3" stroke="rgba(189,255,0,.4)" strokeWidth={1.6} fill="none" strokeLinecap="round" /><circle cx={20} cy={12} r={2.4} fill="#BDFF00" opacity={0.55} /><circle cx={34} cy={8} r={3} fill="#BDFF00" opacity={0.8} /><circle cx={52} cy={3} r={3.6} fill="#BDFF00" /></svg>
              </div>
              <div style={{ height: 6, background: 'rgba(234,229,219,.1)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${((step + 1) / TOTAL) * 100}%`, background: '#BDFF00', borderRadius: 99, boxShadow: '0 0 12px rgba(189,255,0,.5)', transition: `width .55s ${EASE}` }} />
              </div>
            </div>

            {/* card */}
            <div style={{ background: 'linear-gradient(168deg, rgba(15,42,26,.55), rgba(15,15,14,.6))', border: '1px solid rgba(234,229,219,.1)', borderRadius: 24, padding: '34px 32px', boxShadow: '0 30px 70px -40px rgba(0,0,0,.6)' }}>
              <div key={step} style={{ animation: `evkStepIn .45s ${EASE}` }}>
                {step === 0 && <Step0 terms={terms} setTerms={setTerms} />}
                {step === 1 && <Step1 {...{ sexo, setSexo, idade, setIdade, altura, setAltura, peso, setPeso }} />}
                {step === 2 && <Step2 {...{ reqHealth, healthAns, setHealth }} />}
                {step === 3 && <StepCards titulo="Qual é o seu objetivo?" opts={OBJETIVOS} sel={objetivo} onSel={setObjetivo} />}
                {step === 4 && <StepCards titulo="Seu nível de atividade" opts={ATIVIDADES} sel={atividade} onSel={setAtividade} />}
                {step === 5 && <StepCards titulo="Sua experiência de treino" sub="É diferente do seu dia a dia — aqui é há quanto tempo você treina de forma consistente." opts={EXPERIENCIAS} sel={experiencia} onSel={setExperiencia} />}
                {step === 6 && <Step6 {...{ local, setLocal, equipsCasa, toggleEquip, limparEquips: () => setEquipsCasa([]), treinoDias, toggleDia, tempo, limiteTempoTreino, setTempo: escolherTempo }} />}
                {step === 7 && <Step7 {...{ padrao, setPadrao, alergias, toggleAlergia, naoCurto, addFood, removeFood, orcamento, setOrcamento }} />}
              </div>
            </div>

            {camposAConfirmar.some((c) => ETAPA_DO_CAMPO[c] === step) && (
              <section role="alert" style={{ marginTop: 16 }}>
                <p>Não foi possível ler: {camposAConfirmar.filter((c) => ETAPA_DO_CAMPO[c] === step).map((c) => ROTULOS_CAMPOS_PERFIL[c] ?? c).join(', ')}.
                  Os valores iniciais do formulário não são dados recuperados. Confira suas escolhas antes de confirmar.</p>
                <button type="button" onClick={() => setCamposAConfirmar((cs) => cs.filter((c) => ETAPA_DO_CAMPO[c] !== step))}>
                  Confirmo os dados desta etapa
                </button>
              </section>
            )}
            {erro && <p role="alert" style={{ color: '#E5484D', fontSize: '.9rem', marginTop: 14 }}>{erro}</p>}

            {/* footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, gap: 14 }}>
              {step > 0 ? <button onClick={voltar} className="evk-voltar" style={{ background: 'none', border: '1px solid rgba(234,229,219,.2)', color: 'rgba(234,229,219,.8)', fontWeight: 600, fontSize: '1rem', padding: '14px 24px', borderRadius: 13, cursor: 'pointer', transition: 'border-color .25s ease, background .25s ease' }}>Voltar</button> : <span />}
              <button onClick={continuar} className={canCont() ? 'hov-btn' : ''} style={{ border: 'none', cursor: canCont() ? 'pointer' : 'default', fontWeight: 700, fontSize: '1.02rem', padding: '15px 30px', borderRadius: 13, transition: `transform .25s ${EASE},box-shadow .3s ease,opacity .25s ease`, ...(canCont() ? { background: '#BDFF00', color: '#0D2818' } : { background: 'rgba(234,229,219,.1)', color: 'rgba(234,229,219,.4)', pointerEvents: 'none' }) }}>
                {step === TOTAL - 1 ? 'Gerar meu plano' : 'Continuar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {fase === 'gerando' && <Gerando pct={genPct} />}

      {fase === 'resultado' && dieta?.gate.comportamento === 'ROTEAR' && <GateB motivos={dieta.gate.motivos} onRevisar={recomecar} onEntrar={() => router.replace('/app')} />}
    </div>
  );
}

/* ════════════════════ Passos ════════════════════ */

function Step0({ terms, setTerms }: { terms: [boolean, boolean, boolean]; setTerms: (t: [boolean, boolean, boolean]) => void }) {
  // Documentos LINKADOS (LinkLegal: nova aba, não marca o checkbox). É AQUI que o aceite
  // é persistido (`salvarPerfilServidor(..., consentimentos)`), então este é o ponto de
  // consentimento que mais precisa do texto acessível — LGPD/CDC, cofre §Leva 1.
  const linhas = [
    <>Confirmo que tenho <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>18 anos ou mais</strong>.</>,
    <>Li e aceito os <LinkLegal href="/termos">Termos de Uso</LinkLegal> e o <LinkLegal href="/aviso">Aviso (disclaimer)</LinkLegal>.</>,
    <>Autorizo o tratamento dos meus dados para gerar meu plano, conforme a <LinkLegal href="/privacidade">Política de Privacidade</LinkLegal> (LGPD).</>,
  ];
  const tog = (i: number) => { const n = [...terms] as [boolean, boolean, boolean]; n[i] = !n[i]; setTerms(n); };
  return (
    <div>
      <h2 style={{ ...h2, marginBottom: 14 }}>Antes de começar</h2>
      <p style={{ margin: '0 0 26px', color: 'rgba(234,229,219,.66)', lineHeight: 1.6, fontSize: '.98rem' }}>O Adaptkorpus é uma ferramenta de uso geral e educacional. Ele <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>sugere</strong> um plano de treino e dieta — você está sempre no comando e pode ajustar tudo. Não é prescrição médica, nutricional ou de educação física, e não substitui um profissional.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {linhas.map((l, i) => (
          <LinhaConsentimento
            key={i}
            on={!!terms[i]}
            onToggle={() => tog(i)}
            style={{ gap: 13, background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 14, padding: 16 }}
          >
            {l}
          </LinhaConsentimento>
        ))}
      </div>
    </div>
  );
}

function Step1({ sexo, setSexo, idade, setIdade, altura, setAltura, peso, setPeso }: {
  sexo: Sexo; setSexo: (v: Sexo) => void; idade: string; setIdade: (v: string) => void;
  altura: string; setAltura: (v: string) => void; peso: string; setPeso: (v: string) => void;
}) {
  return (
    <div>
      <h2 style={h2}>Sobre você</h2>
      <div style={labelCap}>Sexo biológico</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
        {(['feminino', 'masculino'] as Sexo[]).map((sx) => (
          <div key={sx} onClick={() => setSexo(sx)} style={{ ...segBase, ...(sexo === sx ? segSel : {}) }}>{sx === 'feminino' ? 'Feminino' : 'Masculino'}</div>
        ))}
      </div>
      <p style={{ margin: '0 0 26px', fontSize: '.85rem', color: 'rgba(234,229,219,.5)' }}>Usamos só para estimar seu gasto calórico.</p>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {[['Idade', idade, setIdade, 'anos'], ['Altura', altura, setAltura, 'cm'], ['Peso', peso, setPeso, 'kg']].map(([lb, v, set, u]) => (
          <div key={lb as string} style={{ flex: 1, minWidth: 120 }}>
            <div style={labelCap}>{lb as string}</div>
            <div style={inputBox}><input type="number" inputMode="numeric" value={v as string} onChange={(e) => (set as (s: string) => void)(e.target.value)} style={inputInner} /><span style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.45)' }}>{u as string}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Step2({ reqHealth, healthAns, setHealth }: { reqHealth: { id: string; q: string }[]; healthAns: Record<string, SimNaoV>; setHealth: (id: string, v: SimNaoV) => void }) {
  const hBtn = (id: string, val: SimNaoV): CSSProperties => {
    const on = healthAns[id] === val; const danger = val === 'sim';
    return { cursor: 'pointer', flex: 1, padding: 12, borderRadius: 11, fontWeight: 600, fontSize: '.92rem', transition: 'all .25s ease', textAlign: 'center',
      border: `1px solid ${on ? (danger ? 'rgba(229,72,77,.6)' : 'rgba(189,255,0,.5)') : 'rgba(234,229,219,.14)'}`,
      background: on ? (danger ? 'rgba(229,72,77,.14)' : 'rgba(189,255,0,.1)') : 'rgba(234,229,219,.04)',
      color: on ? (danger ? '#E5484D' : '#BDFF00') : 'rgba(234,229,219,.7)' };
  };
  return (
    <div>
      <h2 style={{ ...h2, marginBottom: 12 }}>Sua segurança em primeiro lugar</h2>
      <p style={{ margin: '0 0 24px', color: 'rgba(234,229,219,.66)', lineHeight: 1.6, fontSize: '.96rem' }}>Não somos médicos e não fazemos diagnóstico. Responda com sinceridade — se algo se aplicar, vamos <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>recomendar acompanhamento profissional</strong> em vez de gerar um plano automático.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {reqHealth.map((q) => (
          <div key={q.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 14, padding: '14px 16px' }}>
            <span style={{ fontSize: '.96rem', fontWeight: 500, flex: 1, minWidth: 160 }}>{q.q}</span>
            <div style={{ display: 'flex', gap: 8, width: 160 }}>
              <button onClick={() => setHealth(q.id, 'sim')} style={hBtn(q.id, 'sim')}>Sim</button>
              <button onClick={() => setHealth(q.id, 'nao')} style={hBtn(q.id, 'nao')}>Não</button>
            </div>
          </div>
        ))}
      </div>
      <p style={{ margin: '18px 0 0', fontSize: '.85rem', color: 'rgba(234,229,219,.45)' }}>Guardamos só o necessário para isso.</p>
    </div>
  );
}

function StepCards<T extends string>({ titulo, sub, opts, sel, onSel }: { titulo: string; sub?: string; opts: { id: T; t: string; d: string }[]; sel: T; onSel: (v: T) => void }) {
  return (
    <div>
      <h2 style={{ ...h2, marginBottom: sub ? 8 : 22 }}>{titulo}</h2>
      {sub && <p style={{ margin: '0 0 22px', fontSize: '.9rem', color: 'rgba(234,229,219,.55)', lineHeight: 1.5 }}>{sub}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {opts.map((o) => (
          <div key={o.id} onClick={() => onSel(o.id)} style={{ ...cardBase, ...(sel === o.id ? cardSel : {}) }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div><div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 2 }}>{o.t}</div><div style={{ fontSize: '.9rem', color: 'rgba(234,229,219,.6)' }}>{o.d}</div></div>
              {sel === o.id && <CheckCircle />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Step6({ local, setLocal, equipsCasa, toggleEquip, limparEquips, treinoDias, toggleDia, tempo, limiteTempoTreino, setTempo }: {
  local: EquipamentoDisp; setLocal: (v: EquipamentoDisp) => void;
  equipsCasa: EquipamentoCasa[]; toggleEquip: (eq: EquipamentoCasa) => void; limparEquips: () => void;
  treinoDias: Weekday[]; toggleDia: (w: Weekday) => void; tempo: number; limiteTempoTreino?: PerfilResumo['limiteTempoTreino']; setTempo: (v: number) => void;
}) {
  return (
    <div>
      <h2 style={h2}>Onde e quando você treina</h2>
      <div style={labelCap}>Local e equipamento</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {LOCAIS.map((o) => (
          <div key={o.id} onClick={() => setLocal(o.id)} style={{ ...cardBase, ...(local === o.id ? cardSel : {}) }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div><div style={{ fontSize: '1.02rem', fontWeight: 700, marginBottom: 2 }}>{o.t}</div><div style={{ fontSize: '.88rem', color: 'rgba(234,229,219,.6)' }}>{o.d}</div></div>
              {local === o.id && <CheckCircle />}
            </div>
            {o.id === 'casa' && local === 'casa' && (
              <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(234,229,219,.1)' }}>
                <ChecklistEquipamento selecionados={equipsCasa} onToggle={toggleEquip} onLimpar={limparEquips} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={labelCap}>Quais dias você treina?</div>
      <p style={{ margin: '0 0 2px', fontSize: '.9rem', color: 'rgba(234,229,219,.6)', lineHeight: 1.5 }}>Escolha os dias em que você treina. Os outros são descanso — faz parte do plano.</p>
      <SeletorDias treinoDias={treinoDias} onToggle={toggleDia} stripMarginTop={14} />
      <div style={{ marginTop: 22 }}>
        <div style={labelCap}>Tempo por sessão</div>
        <div style={{ display: 'flex', gap: 7 }}>{[30, 45, 60, 75].map((t) => <button type="button" aria-pressed={t === 75 ? limiteTempoTreino === 'sem_limite' : tempo === t && limiteTempoTreino !== 'sem_limite'} key={t} onClick={() => setTempo(t)} style={{ ...segBase, ...((t === 75 ? limiteTempoTreino === 'sem_limite' : tempo === t && limiteTempoTreino !== 'sem_limite') ? segSel : {}) }}>{t === 75 ? '75+' : t}</button>)}</div>
        {limiteTempoTreino !== 'sem_limite' && tempo >= 75 && <p>Tempo atual: {tempo} min, limitado. Selecione 75+ para confirmar sem limite de tempo.</p>}
      </div>
    </div>
  );
}

function Step7({ padrao, setPadrao, alergias, toggleAlergia, naoCurto, addFood, removeFood, orcamento, setOrcamento }: {
  padrao: '' | 'vegetariano' | 'vegano'; setPadrao: (v: '' | 'vegetariano' | 'vegano') => void;
  alergias: Alergeno[]; toggleAlergia: (a: Alergeno) => void; naoCurto: string[]; addFood: (id: string) => void; removeFood: (id: string) => void;
  /** 💰 Opcional: default `null` = "sem preferência". `canCont()` não olha para isto. */
  orcamento: 'baixo' | 'medio' | 'alto' | null; setOrcamento: (v: 'baixo' | 'medio' | 'alto' | null) => void;
}) {
  return (
    <div>
      <h2 style={h2}>Suas preferências alimentares</h2>
      <div style={labelCap}>Padrão alimentar</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        {PADROES.map((o) => (
          <div key={o.id || 'oni'} onClick={() => setPadrao(o.id)} style={{ ...cardBase, ...(padrao === o.id ? cardSel : {}), minWidth: 130, flex: 1, padding: '16px 18px' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 2 }}>{o.t}</div><div style={{ fontSize: '.84rem', color: 'rgba(234,229,219,.6)' }}>{o.d}</div>
          </div>
        ))}
      </div>
      <p style={{ margin: '0 0 22px', fontSize: '.85rem', color: 'rgba(234,229,219,.5)' }}>Respeitamos isso à risca — nunca sugerimos algo fora do seu padrão.</p>
      <PreferenciasAlimentares alergias={alergias} onToggleAlergia={toggleAlergia} naoCurto={naoCurto} onAddFood={addFood} onRemoveFood={removeFood} contexto="onboarding" orcamento={orcamento} onOrcamento={setOrcamento} />
    </div>
  );
}

/* ════════════════════ Gerando / Gate B ════════════════════ */

function Gerando({ pct }: { pct: number }) {
  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', animation: `evkScreenIn .5s ${EASE}` }}>
      <div style={{ position: 'relative', width: 200, height: 160, marginBottom: 18 }}>
        <svg viewBox="0 0 200 160" fill="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <path d="M20 140 Q80 124 120 80 T180 24" stroke="rgba(189,255,0,.4)" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeDasharray={2400} strokeDashoffset={2400} style={{ animation: `evkDraw 2.2s cubic-bezier(.16,.84,.3,1) infinite` }} />
          <circle cx={20} cy={140} r={4} fill="#BDFF00" style={{ animation: 'evkRise 2s ease-in-out infinite' }} />
          <circle cx={120} cy={80} r={5.5} fill="#BDFF00" style={{ animation: 'evkRise 2s ease-in-out infinite .4s' }} />
          <circle cx={180} cy={24} r={7.5} fill="#BDFF00" style={{ animation: 'evkRise 2s ease-in-out infinite .8s', filter: 'drop-shadow(0 0 10px rgba(189,255,0,.7))' }} />
        </svg>
      </div>
      <h2 style={{ margin: '0 0 12px', fontSize: '1.7rem', fontWeight: 700, letterSpacing: '-.02em' }}>Montando seu plano…</h2>
      <p style={{ margin: '0 0 30px', color: 'rgba(234,229,219,.62)', lineHeight: 1.6, maxWidth: 420, fontSize: '.98rem' }}>Combinando suas respostas com <strong style={{ color: '#BDFF00', fontWeight: 600 }}>regras adaptativas</strong> e uma base de dados reconhecida de alimentos e exercícios.</p>
      <div style={{ width: '100%', maxWidth: 300 }}>
        <div style={{ height: 7, background: 'rgba(234,229,219,.1)', borderRadius: 99, overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: '#BDFF00', borderRadius: 99, boxShadow: '0 0 12px rgba(189,255,0,.6)', transition: 'width .2s linear' }} /></div>
        <div style={{ marginTop: 10, fontSize: '.85rem', fontWeight: 600, color: 'rgba(234,229,219,.5)' }}>{pct}%</div>
      </div>
    </div>
  );
}

/**
 * Gate B — encaminhamento ao profissional. 🔒 Desde a DF 2026-07-27 ele **não é mais uma
 * porta fechada**: a conta já foi criada e a pessoa entra no MODO DIÁRIO (registra o que fez,
 * sem receber plano). O encaminhamento continua sendo a mensagem principal da tela; o que
 * mudou é que existe um caminho para dentro. Os motivos aparecem AQUI, uma vez — no app eles
 * não se repetem (o cartão permanente não rotula a condição todo dia).
 */
function GateB({ motivos, onRevisar, onEntrar }: { motivos: string[]; onRevisar: () => void; onEntrar: () => void }) {
  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', animation: `evkScreenIn .5s ${EASE}` }}>
      <div style={{ width: '100%', maxWidth: 500, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(22,163,74,.16)', border: '1px solid rgba(22,163,74,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 26px' }}>
          <svg width={32} height={32} viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-4.4-7-9.6A4.4 4.4 0 0112 8a4.4 4.4 0 017 3.4c0 5.2-7 9.6-7 9.6z" stroke="#16A34A" strokeWidth={1.8} strokeLinejoin="round" /><path d="M9 11.5h1.6l.9-1.6 1 3 .9-1.4H16" stroke="#16A34A" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h1 style={{ margin: '0 0 16px', fontSize: '1.9rem', fontWeight: 700, letterSpacing: '-.02em' }}>Vamos com cuidado aqui</h1>
        <p style={{ margin: '0 0 14px', color: 'rgba(234,229,219,.7)', lineHeight: 1.65, fontSize: '1.02rem' }}>Pelo que você respondeu, seu caso pede o <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>acompanhamento de um profissional de saúde</strong>. Por segurança, não vamos gerar um plano automático agora.</p>
        {motivos.length > 0 && <p style={{ margin: '0 0 14px', color: 'rgba(234,229,219,.55)', fontSize: '.9rem' }}>{motivos.join(' · ')}</p>}
        <p style={{ margin: '0 0 20px', color: 'rgba(234,229,219,.6)', lineHeight: 1.65, fontSize: '.98rem' }}>Procure um médico, nutricionista ou educador físico — quando fizer sentido, a gente está aqui.</p>
        <p style={{ margin: '0 0 32px', color: 'rgba(234,229,219,.72)', lineHeight: 1.65, fontSize: '.98rem' }}>Você pode usar o app como um <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>diário</strong>: registrar seus treinos, refeições, cardio e peso, e levar esse histórico para a consulta.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={onEntrar} className="hov-btn" style={{ background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1rem', padding: '14px 26px', border: 'none', borderRadius: 13, cursor: 'pointer' }}>Entrar no app</button>
          <button onClick={onRevisar} className="evk-voltar" style={{ background: 'none', border: '1px solid rgba(234,229,219,.22)', color: 'rgba(234,229,219,.82)', fontWeight: 600, fontSize: '.98rem', padding: '13px 24px', borderRadius: 12, cursor: 'pointer' }}>Revisar respostas</button>
          <Link href="/aviso" className="evk-voltar" style={{ background: 'none', border: '1px solid rgba(234,229,219,.22)', color: 'rgba(234,229,219,.82)', fontWeight: 600, fontSize: '.98rem', padding: '13px 24px', borderRadius: 12, textDecoration: 'none' }}>Ver conteúdos gerais</Link>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════ Primitivos ════════════════════ */

function Backdrop() {
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: '-12%', right: '-8%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(22,163,74,.20), transparent 68%)', filter: 'blur(22px)', animation: 'evkDrift 24s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: '-16%', left: '-12%', width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, rgba(189,255,0,.06), transparent 70%)', filter: 'blur(22px)', animation: 'evkDrift 30s ease-in-out infinite reverse' }} />
    </div>
  );
}

function Logo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-label="Adaptkorpus">
      <line x1={28} y1={16} x2={28} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" /><line x1={29} y1={50} x2={68} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" />
      <path d="M33 50 Q50 38 70 18" stroke="#BDFF00" strokeWidth={3.5} fill="none" strokeLinecap="round" /><circle cx={35} cy={50} r={4.5} fill="#BDFF00" /><circle cx={52} cy={35} r={5} fill="#BDFF00" /><circle cx={70} cy={18} r={6} fill="#BDFF00" />
    </svg>
  );
}
const Marca = ({ size }: { size: string }) => <span style={{ fontWeight: 800, fontSize: size, letterSpacing: '-.02em' }}><span style={{ color: '#EAE5DB' }}>adapt</span><span style={{ color: '#BDFF00', marginLeft: '0.02em' }}>korpus</span></span>;
const CheckCircle = () => <span style={{ width: 26, height: 26, minWidth: 26, borderRadius: '50%', background: '#BDFF00', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={14} height={14} viewBox="0 0 24 24"><path d="M5 12l5 5 9-11" stroke="#0D2818" strokeWidth={3.4} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></span>;
