'use client';

import { useEffect, useState, type CSSProperties, type ReactNode, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { listarSubstituicoesPrato, listarSubstituicoesExercicio } from '@/lib/engine';
import type { FlagsSaude } from '@/lib/engine';
import { recomputarPlano } from '@/lib/session';
import { marcarPratoCansado, pratosCansadosAtivos, type PratoCansado } from '@/lib/rotacao-pratos';
import { registrarCardio, registrarSessao, registrarSessaoEm, lerHistorico, lerPesos, hojeISO, novaSessaoDe, reconciliarHistorico, registrarPesoLocal, registrarSinalFadiga, salvarCalibracao, sessoesResistidas, sessoesTreino, substituirHistorico, substituirPesos, type RegistroPeso, type SessaoHistorico } from '@/lib/treino-historico';
import { reancorarPesoDoPlanoLocal, resolverPesoDoPlanoLocal } from '@/lib/peso-plano';
import { carregarHistoricoServidor, carregarPesosServidor, enviarSessaoTreino, registrarPesoServidor } from '@/lib/persistencia/sync';
import { inicialDe } from '@/lib/auth/usuario';
import { supabaseConfigurado } from '@/lib/supabase/env';
import { exercicioEfetivo, exerciciosRecentes, feedbackAgregadoPorGrupo, progressoDosExercicios, retomadaDoHistorico, sinaisFadigaDoHistorico, type ProgressoExercicio } from '@/lib/treino-progressao';
import { alvoDaSemana, aplicarRetomada, estadoDoCiclo, rirAlvoDaSemana, semanaDoCiclo, type EstadoRetomada } from '@/lib/engine';
import { avisoPausaVisivel } from '@/lib/pausa-reconhecida';
import { descansoDoExercicio, rotuloDescanso } from '@/lib/engine/descanso';
import { metaCardioComRetomada, metaCardioSemanal, resumoCardioSemana, ROTULO_INTENSIDADE, ROTULO_MODALIDADE, type IntensidadeCardio, type MetaCardio, type ModalidadeCardio } from '@/lib/engine/cardio';
import { conteudoDoDiaExcedente } from '@/lib/engine/dia-de-cardio';
import { elegibilidade } from '@/lib/engine/tecnicas-avancadas';
import { minutosAcumulados, registrosDaSemana, type RegistroCardioDatado } from '@/lib/cardio-semana';
import RegistrarCardio, { CardioSemana } from './Cardio';
import FrequenciaGrupos from './FrequenciaGrupos';
import FiqueiDoente, { AvisoPausaReconhecida } from './FiqueiDoente';
import { DietaDiario, HojeDiario, TreinoDiario, REFEICOES_DIARIO } from './ModoDiario';
import DiaDaDieta from './DiaDaDieta';
import { EscadaPill } from './EscadaDegraus';
import { BadgeFavorito, EstrelaFavorito } from './Favoritos';
import { bandaChama, diasDeTreino } from '@/lib/chama';
import type { Weekday } from '@/lib/semana';
import { sessaoDeHojeIdx, weekdayHojeIdx } from '@/lib/semana';
import SessaoTreino, { type ResumoSessao } from './SessaoTreino';
import SuaSemana from './SuaSemana';
import { registrarEvento } from '@/lib/metricas/registrar';
import GraficoLinha from './GraficoLinha';
import { ContadorTreinos } from './ChamaContador';
import RegistrarTreino from './RegistrarTreino';
import CargasHistorico from './CargasHistorico';
import ListaCompras from './ListaCompras';
import EditarPerfil from './EditarPerfil';
import { DetalheExercicio, DetalhePrato, DetalheSessao } from './DetalheModais';
import { useRegistro, HistoricoDieta, type StatusRefeicao } from './RegistroRefeicao';
import { EmptyCard, estiloBotaoPrimario } from '@/components/estados/ui';
import { EXERCISES_SEED, FOODS_BY_ID_SEED, RECIPES_SEED } from '@/lib/data/seed';
import type {
  CardapioItem, DiaTreino, NivelAtividade, NivelExperiencia, Objetivo, ResultadoMotor, ResultadoTreino, Sexo,
} from '@/lib/engine';
import type { Alergeno, EquipamentoCasa, EquipamentoDisp, Exercise, RecipeMacros } from '@/lib/data/types';
import { chaveLocal } from '@/lib/escopo-local';

/**
 * Painel (área logada) — porte FIEL do Evokorpus App.dc.html (estilos inline exatos +
 * evkPop/evkScreenIn). Ligado ao motor determinístico real (gate/dieta/treino/F.2).
 */

export interface PerfilResumo {
  sexo: Sexo; idade: number; alturaCm: number; pesoKg: number; objetivo: Objetivo;
  nivelAtividade: NivelAtividade; nivelExperiencia: NivelExperiencia; equipamento: EquipamentoDisp;
  preferencia: 'vegano' | 'vegetariano' | null; alergenos: Alergeno[]; diasDisponiveis: number; tempoPorSessaoMin: number;
  /** Dias da semana em que treina (Seg→Dom). É a fonte de verdade da agenda; `diasDisponiveis` = length. */
  treinoDias: Weekday[];
  /** "Alimentos que não curto" — IDs da paleta curada (preferência relaxável no motor). */
  naoCurto: string[];
  /** Exercícios FAVORITOS (⭐ V8.2, DF #12): o montador os prefere sempre que couberem
   *  (isentos da variedade; filtros duros intactos). Espelho positivo do "não gosto". */
  favoritos?: string[];
  /** Checklist de equipamento de CASA (modelo 2 níveis, DF 2026-07-04). Vazio = "nenhum
   *  equipamento". Só relevante quando equipamento === 'casa'. */
  equipamentosCasa?: EquipamentoCasa[];
  /** Pratos em descanso ("Cansei deste prato") — nível do PRATO, distinto de `naoCurto`
   *  (nível do alimento). Retornam sozinhos após 21 dias. */
  pratosCansados: PratoCansado[];
  /** Flags de saúde do gate — necessárias para recalcular o plano (Editar perfil). */
  flagsSaude: FlagsSaude;
  /** Âncora do MESOCICLO (v2 §1/§7, DF 2026-07-08): data ISO do início do ciclo de 6
   *  semanas (fonte de verdade da semana). Nasce no 1º boot do Painel; o deload reativo
   *  reancora (hoje − 35 d). Ausente = conta ainda não ancorada (v1). */
  mesocicloInicio?: string;
  /** Fim (ISO, exclusivo) do alívio disparado pelo botão de fadiga / ≥3 "difícil" — marca
   *  explícita do deload REATIVO (Leva 1B, DF 2026-07-26). Único estado que a mitigação do
   *  relógio introduz; expira sozinho quando `hoje` o alcança. */
  deloadAte?: string;
  /** Modo força (preset opt-in v2 §4): compostos travados em 6 reps → 6RM. O motor
   *  IGNORA o flag p/ iniciante (o toggle nem aparece). */
  modoForca?: boolean;
  /**
   * 🔒 Técnicas avançadas (Leva F, §🥊 — DF 2026-07-31): opt-in DESLIGADO por padrão. O flag
   * é só a intenção da pessoa; o PORTÃO de elegibilidade é recalculado a cada vez
   * (`engine/tecnicas-avancadas`), então perder o histórico ou entrar em faixa protetiva
   * fecha a feature sem precisar reescrever o perfil.
   * 🔴 O motor NUNCA adiciona técnica sozinho — o flag só torna a escolha POSSÍVEL.
   */
  tecnicasAvancadas?: boolean;
  /** Carimbo ISO 8601 do "Fiquei doente" (Leva 2 · Bloco 4, DF 2026-07-27) — o RECONHECIMENTO
   *  da pausa, e nada mais. 🔴 O MOTOR NUNCA LÊ ESTE CAMPO (`engine-sem-reconhecido.test.ts`):
   *  quem avisa e quem some têm o mesmo comportamento. 🔴 Motive-free por LGPD — sem motivo,
   *  sintoma, data de volta ou contagem de dias. Sai no 1º treino registrado. */
  reconhecidoEm?: string;
}

const EASE = 'cubic-bezier(.22,.61,.36,1)';
const r0 = (n: number) => Math.round(n);
const PADRAO_LABEL: Record<string, string> = { empurrar: 'Empurrar', puxar: 'Puxar', agachar: 'Agachar', dobradica_quadril: 'Dobradiça', core: 'Core', cardio: 'Cardio', isolado: 'Isolado' };
const OBJETIVO_LABEL: Record<Objetivo, string> = { emagrecimento: 'Emagrecer', massa: 'Ganhar massa', saude: 'Manter / Saúde' };
const ATIV_LABEL: Record<NivelAtividade, string> = { sedentario: 'Sedentário', leve: 'Leve', moderado: 'Moderado', intenso: 'Intenso', muito_intenso: 'Muito intenso' };
// `f` = fator de escala (move a matemática); `r` = rótulo exibido, em porcentagem da porção.
const PORCOES: { f: number; r: string }[] = [{ f: 0.5, r: '50%' }, { f: 0.75, r: '75%' }, { f: 1, r: '100%' }, { f: 1.25, r: '125%' }, { f: 1.5, r: '150%' }, { f: 2, r: '200%' }];

// estilos exatos do protótipo
const cardSoft: CSSProperties = { background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 18, padding: '20px 22px' };
const gradCard: CSSProperties = { background: 'linear-gradient(165deg, rgba(22,163,74,.1), rgba(15,15,14,.5))', border: '1px solid rgba(234,229,219,.1)', borderRadius: 20, padding: 26 };
const kicker: CSSProperties = { fontSize: '.76rem', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)' };
const pill: CSSProperties = { fontSize: '.84rem', color: 'rgba(234,229,219,.8)', background: 'rgba(234,229,219,.06)', borderRadius: 8, padding: '6px 11px' };
const sec: CSSProperties = { animation: `evkPop .45s ${EASE}` };

function escalar(m: RecipeMacros, s: number): RecipeMacros {
  return { kcal: m.kcal * s, proteinaG: m.proteinaG * s, carboidratoG: m.carboidratoG * s, gorduraG: m.gorduraG * s };
}

// Data curta pt-BR ('28 jun') p/ sessões manuais — determinística, sem locale do ambiente.
const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function fmtDataCurta(dataISO: string): string {
  const [, m, d] = dataISO.split('-').map(Number);
  return m && d ? `${d} ${MES_CURTO[m - 1]}` : dataISO;
}

type Aba = 'hoje' | 'treino' | 'dieta' | 'progresso' | 'historico' | 'perfil';
const ABAS_VALIDAS = new Set<Aba>(['hoje', 'treino', 'dieta', 'progresso', 'historico', 'perfil']);
type SessaoLog = SessaoHistorico; // ResumoSessao + { n, dataISO } (persistido em evk_treinos)
type Feedback = 'facil' | 'na_medida' | 'dificil';
interface OpcaoPrato { prato: CardapioItem['prato']; escala: number; macros: RecipeMacros; diaNew: RecipeMacros }
type Modal =
  | { tipo: 'prato'; idx: number; base: string; opcoes: OpcaoPrato[]; excl: string[] }
  | { tipo: 'porcao'; idx: number; base: string }
  | { tipo: 'exercicio'; d: number; s: number; base: string; opcoes: Exercise[]; excl: string[] }
  | null;

export default function Painel({ perfil: perfilProp, dieta: dietaProp, treino: treinoProp, onSair, onPerfilChange, desfechoC, modoDiario = false }: {
  perfil: PerfilResumo; dieta: ResultadoMotor; treino: ResultadoTreino; onSair: () => void;
  /** Persistência da sessão: chamado quando o perfil muda (Editar perfil) para manter o reload coerente. */
  onPerfilChange?: (p: PerfilResumo) => void; desfechoC?: boolean;
  /**
   * 🔒 MODO DIÁRIO (cofre, DF 2026-07-27 — gate `ROTEAR`): a pessoa registra e lê o próprio
   * histórico, mas NÃO recebe prescrição. Some plano, sessão guiada, cardápio, meta de cardio
   * e progressão — sem tela vazia e sem "desbloqueie". Ver `lib/modo-diario.ts`.
   */
  modoDiario?: boolean;
}) {
  const router = useRouter();
  // Plano e perfil viram estado para suportar "Editar perfil → recalcular" em runtime.
  const [perfil, setPerfil] = useState<PerfilResumo>(perfilProp);
  const [dieta, setDieta] = useState<ResultadoMotor>(dietaProp);
  const [treino, setTreino] = useState<ResultadoTreino>(treinoProp);
  const restricoes = { alergenos: perfil.alergenos, preferencia: perfil.preferencia };
  // Aba ativa persistida (evk_aba): reload/voltar restauram exatamente a aba anterior.
  const [aba, setAba] = useState<Aba>(() => {
    if (typeof window === 'undefined') return 'hoje';
    const a = window.localStorage.getItem(chaveLocal('evk_aba')) as Aba | null;
    return a && ABAS_VALIDAS.has(a) ? a : 'hoje';
  });
  useEffect(() => { try { window.localStorage.setItem(chaveLocal('evk_aba'), aba); } catch { /* noop */ } }, [aba]);
  const [vista, setVista] = useState<null | 'compras'>(null);
  const [editando, setEditando] = useState(false);
  const [detalhe, setDetalhe] = useState<{ tipo: 'prato'; idx: number } | { tipo: 'ex'; d: number; s: number } | null>(null);
  const [detalheSessao, setDetalheSessao] = useState<SessaoLog | null>(null);
  const [cardItens, setCardItens] = useState<CardapioItem[]>(dieta.cardapio?.itens ?? []);
  const [cardTotais, setCardTotais] = useState<RecipeMacros | null>(dieta.cardapio?.totais ?? null);
  const [rotinaDias, setRotinaDias] = useState<DiaTreino[]>(treino.rotina?.dias ?? []);
  const [trocados, setTrocados] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  // Inicial do avatar: NOME real do usuário (user_metadata.nome, gravado no signUp),
  // fallback e-mail — o "V" é só o placeholder do modo MOCK (sem usuário).
  // Fix bloqueador 2026-07-08: ler PRIMEIRO a sessão LOCAL (`getSession()` — síncrona ao
  // storage, sem rede) e só cair no `getUser()` (chamada de REDE ao servidor Auth, que
  // corria com a rotação do refresh-token no boot e intermitentemente falhava → círculo
  // vazio). Uso é SÓ DE EXIBIÇÃO (a inicial) — nenhuma decisão de segurança depende disto.
  const [inicial, setInicial] = useState(supabaseConfigurado() ? '' : 'V');
  useEffect(() => {
    if (!supabaseConfigurado()) return;
    let vivo = true;
    void (async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const auth = createClient().auth;
        const { data: { session } } = await auth.getSession();
        let u = session?.user ?? null;
        if (!u) u = (await auth.getUser()).data.user; // sem sessão local → valida na rede
        if (!vivo || !u) return;
        const n = (u.user_metadata as { nome?: string } | null)?.nome;
        setInicial(inicialDe(n, u.email));
      } catch { /* mantém o estado atual */ }
    })();
    return () => { vivo = false; };
  }, []);

  // 🔒 A série carrega DATA (Leva D). O 1º item é a SEMENTE do perfil, não uma pesagem:
  // entra sem data e por isso nunca conta na janela de 7 dias — só aparece no gráfico.
  const [pesos, setPesos] = useState<RegistroPeso[]>([{ dataISO: null, kg: perfil.pesoKg }]);
  const pesosKg = pesos.map((p) => p.kg);
  // Pesos: cópia LOCAL primeiro (evk_pesos — fix bloqueador 2026-07-08: eram só memória e
  // resetavam a cada reload quando o write-through falhava); depois o servidor:
  //  - servidor NÃO-vazio vence (2º device coerente) e renova a cópia local;
  //  - servidor vazio com local não-vazio → mantém o local e RE-SOBE cada peso (retry
  //    dos writes silenciosamente perdidos); GET falho (null) → local fica.
  useEffect(() => {
    const semente: RegistroPeso = { dataISO: null, kg: perfil.pesoKg };
    const locais = lerPesos();
    if (locais.length > 0) setPesos([semente, ...locais]);
    let vivo = true;
    void carregarPesosServidor().then((doServidor) => {
      if (!vivo || !doServidor) return;
      if (doServidor.length > 0) {
        setPesos([semente, ...substituirPesos(doServidor)]);
      } else if (locais.length > 0) {
        // 🔒 A data VAI JUNTO (Leva D): sem ela, a re-subida carimbaria toda a série com o
        // dia em que a rede voltou — uma semana virando um ponto só, e a janela de 7 dias
        // lendo algo que não aconteceu. Registro legado (sem data) sobe sem data mesmo.
        for (const v of locais) void registrarPesoServidor(v.kg, v.dataISO);
      }
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- semente única no mount
  }, []);
  /**
   * 🔒 O peso com que o PLANO é gerado (Leva D). Não é `perfil.pesoKg` nem a última pesagem:
   * é a média móvel de 7 dias com as duas histereses aplicadas (`lib/peso-plano`).
   *
   * Resolver aqui de novo — `/app/page.tsx` já resolveu no mount — é seguro porque a
   * resolução é IDEMPOTENTE no mesmo dia: as duas chamadas leem a mesma âncora e devolvem o
   * mesmo peso. O que muda o valor é a hidratação do servidor e uma pesagem nova, e é
   * exatamente por isso que `pesos` está nas deps.
   */
  const [pesoMotorKg, setPesoMotorKg] = useState(perfil.pesoKg);
  /** Última âncora já refletida na dieta — evita regerar o cardápio sem o peso ter mudado. */
  const pesoAplicadoRef = useRef(perfil.pesoKg);
  useEffect(() => {
    setPesoMotorKg(resolverPesoDoPlanoLocal({ perfil, pesos, hojeISO: hojeISO() }));
  }, [pesos, perfil]);
  /**
   * 🔒 A frase do recálculo (Leva D). Regras da copy, travadas:
   *  · **passado** — relata o que já aconteceu, não o que vai acontecer;
   *  · sobre o **app**, nunca sobre a pessoa (nada de "você emagreceu"/"seu corpo mudou");
   *  · **sem modo diário**: lá não há plano para recalcular, e a frase pressuporia um.
   *
   * ⚠️ Ela NÃO substitui o subtítulo do `RegistrarPesoRow`. "Um registro rápido mantém seu
   * plano calibrado" continuaria falso no ATO do registro: uma pesagem isolada não move nada
   * (a janela pede ≥ 3 em 7 dias e a âncora anda no máximo 1×/semana). O que é verdade é o
   * fato consumado — e é só ele que a tela diz.
   */
  const notaPesoPlano = !modoDiario && pesoMotorKg !== perfil.pesoKg
    ? `Seu plano foi recalculado com a média dos seus registros de peso (${pesoMotorKg.toFixed(1)} kg).`
    : null;
  const [modal, setModal] = useState<Modal>(null);
  const [dataHoje, setDataHoje] = useState('');
  const [menu, setMenu] = useState(false);
  const [mostrarC, setMostrarC] = useState(desfechoC ?? (dieta.gate.comportamento === 'RESTRINGIR' || dieta.gate.comportamento === 'PISAR'));
  const [sessaoDia, setSessaoDia] = useState<number | null>(null);
  /** Carimbo de início da sessão guiada (ms). Só alimenta `duracao_real_min`. */
  const inicioSessaoRef = useRef<number | null>(null);
  const [sessoes, setSessoes] = useState<SessaoLog[]>([]);
  // Histórico de treino persistido (evk_treinos) — alimenta marcos + progressão de carga.
  useEffect(() => {
    setSessoes(lerHistorico());
    // Logado: RECONCILIAÇÃO local × servidor (fix bloqueador 2026-07-08 — antes um 200
    // com [] APAGAVA o evk_treinos): o servidor vence nas chaves compartilhadas; sessões
    // só-locais sobrevivem e são re-subidas (retry dos writes silenciosamente perdidos —
    // paridade com o self-heal do profile). GET falho (null) → local fica (mock intacto).
    let vivo = true;
    void carregarHistoricoServidor().then((doServidor) => {
      if (!vivo || !doServidor) return;
      const { uniao, faltantes } = reconciliarHistorico(lerHistorico(), doServidor);
      for (const s of faltantes) void enviarSessaoTreino(s);
      setSessoes(substituirHistorico(uniao));
    });
    return () => { vivo = false; };
  }, []);
  // Edição que cai em zona clínica (ROTEAR) → tela de encaminhamento, sem aplicar o plano.
  const [encaminhamento, setEncaminhamento] = useState<string[] | null>(null);
  // V5 — registro de refeições (aderência, persistido em localStorage por dia).
  const registro = useRegistro();
  // Refeições do dia = slots distintos do cardápio, na ordem em que aparecem. Em MODO DIÁRIO
  // não há cardápio: os slots vêm da lista fixa do diário (é vocabulário, não prescrição).
  const refeicoesDia = modoDiario
    ? [...REFEICOES_DIARIO]
    : cardItens.map((it) => it.refeicao).filter((r, i, a) => a.indexOf(r) === i);

  // Contador de treinos (cofre registro-de-aderencia §Contador): dias DISTINTOS, guiado ou
  // manual — só sobe, nunca zera. A comemoração da chama dispara SÓ na transição real de
  // marco causada por um registro (nunca ao montar/hidratar/trocar de tela). Como o registro
  // acontece em telas cheias (sessão guiada / formulário) com a Chama DESMONTADA, o cruzamento
  // fica pendente e o token só incrementa quando a Hoje está visível — a Chama montada vê a
  // mudança e toca a comemoração única (~1,25s) do handoff.
  // Salvaguarda B2 (DF 2026-07-04): eventos de CALIBRAÇÃO não contam dia de treino —
  // a Chama/marcos só veem sessões de treino (sessoesTreino filtra tipo:'calibracao').
  const diasTreinados = diasDeTreino(sessoesTreino(sessoes).map((s) => s.dataISO));
  const [celebrarToken, setCelebrarToken] = useState(0);
  const [celebrarPendente, setCelebrarPendente] = useState(false);
  function aplicarNovoHistorico(novo: SessaoHistorico[]) {
    const antes = bandaChama(diasTreinados);
    if (bandaChama(diasDeTreino(sessoesTreino(novo).map((s) => s.dataISO))) > antes) setCelebrarPendente(true);
    setSessoes(novo);
    // "Fiquei doente" (Bloco 4): o reconhecimento LIMPA no primeiro treino registrado,
    // SEM MENSAGEM NENHUMA (nada de "bem-vindo de volta" — o silêncio é decisão de projeto).
    // Aqui está o ato do registro, que cobre inclusive o treino do MESMO dia do aviso; o
    // guard derivado de `pausaReconhecida` cobre reload e 2º device.
    if (perfil.reconhecidoEm != null) {
      const novaEntrada = novaSessaoDe(novo);
      if (novaEntrada && sessoesTreino([novaEntrada]).length > 0) limparReconhecimento();
    }
    // Write-through p/ o servidor (um gancho cobre guiada/manual/calibração): a sessão
    // recém-gravada é a de maior n. Fire-and-forget — o local já está persistido.
    void enviarSessaoTreino(novaSessaoDe(novo));
  }

  // --- "Fiquei doente" — o RECONHECIMENTO (Leva 2 · Bloco 4, DF 2026-07-27) --------------
  // 🔴 "Entendi" grava o carimbo e NADA MAIS: não toca ciclo, volume, chama, agenda nem
  // meta de cardio. O congelamento do mesociclo já acontece sozinho desde `9ebf1bd` e a
  // rampa entra sozinha pelo gatilho derivado — o botão é o ato de AVISAR, não um comando.
  // O relógio fica aqui, na UI (o motor segue clock-free e nunca lê este campo).
  function reconhecerPausa() {
    const novo = { ...perfil, reconhecidoEm: new Date().toISOString() }; // idempotente: só atualiza o carimbo
    setPerfil(novo);
    onPerfilChange?.(novo);
  }
  function limparReconhecimento() {
    const { reconhecidoEm: _fora, ...novo } = perfil;
    void _fora;
    setPerfil(novo);
    onPerfilChange?.(novo);
  }

  // Calibração manual / adoção de degrau (B2/B3): grava o evento no histórico — o alvo
  // continua função pura do evk_treinos; o próximo render recomputa o progresso.
  function calibrarExercicios(itens: { id: string; nome: string; calibracao: NonNullable<ResumoSessao['exercicios'][number]['calibracao']> }[]) {
    aplicarNovoHistorico(salvarCalibracao(itens));
  }

  // Favoritos (⭐ V8.2, DF #12): alterna o conjunto, persiste na sessão e re-monta o
  // treino (viés determinístico do montador). Estrela do cartão e do modal compartilham
  // este estado único.
  function toggleFavorito(id: string) {
    const atual = new Set(perfil.favoritos ?? []);
    if (atual.has(id)) atual.delete(id); else atual.add(id);
    const novo = { ...perfil, favoritos: [...atual] };
    setPerfil(novo);
    onPerfilChange?.(novo);
    const { treino: nt } = recomputarPlano(novo, { semanaCiclo: opcoesDaSemana(), pesoEfetivoKg: pesoMotorKg });
    setTreino(nt);
    setRotinaDias(nt.rotina?.dias ?? []); // os cartões leem rotinaDias (badge/slots re-montados)
  }
  const favoritosSet = new Set(perfil.favoritos ?? []);

  /**
   * 🔒 TELEMETRIA (Leva C2): `sessao_iniciada` é a métrica nº 1 — ATIVAÇÃO. Sai daqui, do
   * ato de abrir a sessão guiada, não de um `useEffect` de montagem: o teste tem de provar
   * que ela sai QUANDO a sessão inicia.
   */
  function iniciarSessaoGuiada(idx: number) {
    const dia = rotinaDias[idx];
    if (dia) {
      // Relógio na UI, NUNCA no motor (regra do projeto). Só para a duração real.
      inicioSessaoRef.current = Date.now();
      registrarEvento('sessao_iniciada', {
        sessao_id: `${dataHoje}-${idx}`,
        data_agendada: dataHoje,
        semana_ciclo: ciclo.semanaEfetiva,
      });
    }
    setSessaoDia(idx);
  }

  function concluirSessao(r: ResumoSessao) {
    registrarEvento('sessao_concluida', {
      sessao_id: `${dataHoje}-${sessaoDia ?? 0}`,
      // 🔒 Duração REAL medida na UI (início → conclusão). O motor não vê relógio; este
      // carimbo existe só para a métrica "duração planejada × real" da spec. Sem início
      // registrado (registro manual, reload no meio) sai 0 — e 0 lê-se "não medida".
      duracao_real_min: inicioSessaoRef.current
        ? Math.max(0, Math.round((Date.now() - inicioSessaoRef.current) / 60_000))
        : 0,
      exercicios_feitos: r.exercicios?.length ?? 0,
      exercicios_planejados: sessaoDia != null ? (rotinaDias[sessaoDia]?.slots.length ?? 0) : 0,
    });
    aplicarNovoHistorico(registrarSessao(r)); // carimba data + persiste (evk_treinos)
    setFeedback((p) => ({ ...p, ...r.feedback }));
    setSessaoDia(null);
    setAba('progresso');
    window.scrollTo(0, 0);
  }

  // Cardio (Leva 2 · Bloco 1) — entrada PRÓPRIA do histórico (`tipo: 'cardio'`), o que a
  // mantém fora do relógio do mesociclo e dentro da Chama. 🟢 A kcal estimada NÃO toca o
  // plano de dieta: `salvarCardio` não chama `recomputarPlano` nem mexe em `dieta`.
  const [registrandoCardio, setRegistrandoCardio] = useState(false);
  /**
   * Item do dia de cardio que abriu o registro — só PRÉ-PREENCHE modalidade e minutos.
   * 🔒 Nada aqui grava: o caminho de escrita continua sendo o `registrarCardio` único.
   */
  const [cardioPre, setCardioPre] = useState<{ modalidade: string; minutos: number | null } | null>(null);
  function salvarCardio(payload: NonNullable<SessaoHistorico['cardio']>) {
    registrarEvento('cardio_registrado', {
      modalidade: payload.modalidade, minutos: payload.minutos, origem: 'registro_manual',
    });
    aplicarNovoHistorico(registrarCardio(payload));
  }

  // "Registrar treino feito" (formulário pós-fato) — grava na DATA REAL escolhida, no mesmo
  // formato da sessão guiada + origem manual (design_handoff_registro_e_contador_treino).
  const [registrando, setRegistrando] = useState(false);
  function salvarTreinoManual(r: ResumoSessao, dataISO: string, extra: { hora: string; obs?: string }) {
    aplicarNovoHistorico(registrarSessaoEm(r, dataISO, { manual: true, ...extra }));
    setFeedback((p) => ({ ...p, ...r.feedback }));
  }
  // Consome o cruzamento pendente com a Hoje visível: o 1º commit monta a Chama com o token
  // atual; este efeito roda DEPOIS e incrementa → a Chama vê a transição e comemora.
  const chamaVisivel = !vista && aba === 'hoje' && !registrando && sessaoDia === null && !editando && !encaminhamento;
  useEffect(() => {
    if (celebrarPendente && chamaVisivel) {
      setCelebrarPendente(false);
      setCelebrarToken((t) => t + 1);
    }
  }, [celebrarPendente, chamaVisivel]);


  // Editar perfil → recalcular: roda o motor determinístico real com o novo perfil
  // (gate de saúde + dieta + treino), igual ao onboarding. Sem IA, mesmo input → mesma saída.
  // Persiste o novo perfil na sessão (onPerfilChange) para o reload refletir a edição.
  function recalcular(novo: PerfilResumo) {
    // 🔒 Leva D: o peso é RESOLVIDO aqui, com o perfil novo, e o resultado é o mesmo que o
    // efeito da âncora produziria — sem isto a edição geraria um plano com o peso digitado e
    // o efeito o trocaria no quadro seguinte (dois planos em sequência, piscando).
    const dia = hojeISO();
    // 🔒 Editar o peso REANCORA (spec §4, DF 2026-07-31): vale na hora, e a série só retoma
    // com ≥ 3 pesagens POSTERIORES. Sem isto a correção manual era inócua — quem digitasse
    // 65 com três pesagens em 61,4 continuava com o plano em 61,4, sem nenhuma saída.
    // 🔴 O que a reancoragem NÃO faz: encurtar a carência do gate. Quem está em faixa
    // protetiva continua nela pelos 14 dias — digitar um número não abre o portão.
    if (novo.pesoKg !== perfil.pesoKg) reancorarPesoDoPlanoLocal(novo.pesoKg, dia);
    const pesoEfetivoKg = resolverPesoDoPlanoLocal({ perfil: novo, pesos, hojeISO: dia });
    setPesoMotorKg(pesoEfetivoKg);
    pesoAplicadoRef.current = pesoEfetivoKg; // já aplicado aqui — o efeito não repete
    const { dieta: nd, treino: nt } = recomputarPlano(novo, { semanaCiclo: opcoesDaSemana(), pesoEfetivoKg });
    // Fail-safe clínico (cofre, princípio 4 — gate-de-saude-evokorpus): se a edição cair em
    // ROTEAR (ex.: IMC < 16) o motor NÃO gera plano. Não persistimos nem substituímos o plano
    // válido atual — mostramos o encaminhamento e deixamos revisar ou manter o plano de antes.
    if (nd.gate.comportamento === 'ROTEAR' || !nd.plano || !nt.rotina) {
      setEditando(false);
      setEncaminhamento(nd.gate.motivos ?? []);
      window.scrollTo(0, 0);
      return;
    }
    setEncaminhamento(null);
    onPerfilChange?.(novo);
    setPerfil(novo);
    setDieta(nd);
    setTreino(nt);
    setCardItens(nd.cardapio?.itens ?? []);
    setCardTotais(nd.cardapio?.totais ?? null);
    setRotinaDias(nt.rotina?.dias ?? []);
    setTrocados(new Set());
    setMostrarC(nd.gate.comportamento === 'RESTRINGIR' || nd.gate.comportamento === 'PISAR');
    setEditando(false);
    setAba('hoje');
    window.scrollTo(0, 0);
  }

  // ⑥ `textTransform: capitalize` maiusculizava CADA palavra ("Quarta-Feira, 29 De
  // Julho"). Em pt-BR só a primeira letra sobe — a capitalização passa para cá e o CSS sai.
  useEffect(() => {
    const d = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    setDataHoje(d.charAt(0).toUpperCase() + d.slice(1));
  }, []);
  const marcar = (k: string) => setTrocados((prev) => new Set(prev).add(k));

  // "Cansei deste prato" (cofre, parametros-motor-substituicao-evokorpus §Variedade): pratos em
  // descanso na rotação. O prazo/retorno de 21 dias é resolvido na sessão (relógio fora do motor).
  const cansadosAtivos = pratosCansadosAtivos(perfil.pratosCansados);
  const nomePrato = (id: string) => RECIPES_SEED.find((r) => r.id === id)?.nome ?? id;
  const pratosDescanso = perfil.pratosCansados
    .filter((c) => cansadosAtivos.includes(c.id))
    .map((c) => ({ id: c.id, nome: nomePrato(c.id), ate: c.ate }));

  // Aplica um novo perfil (só mudou a rotação de pratos — saúde/dias intactos) e recomputa o
  // cardápio. Determinístico: mesmo perfil → mesmo cardápio. Não mexe no treino (não muda).
  function aplicarRotacao(novo: PerfilResumo) {
    const { dieta: nd } = recomputarPlano(novo, { pesoEfetivoKg: pesoMotorKg });
    if (!nd.plano || !nd.cardapio) return; // robustez (saúde não muda aqui → não vira ROTEAR)
    onPerfilChange?.(novo);
    setPerfil(novo);
    setDieta(nd);
    setCardItens(nd.cardapio.itens);
    setCardTotais(nd.cardapio.totais);
    setTrocados(new Set());
  }
  function cansarDoPrato(pratoId: string) {
    aplicarRotacao({ ...perfil, pratosCansados: marcarPratoCansado(perfil.pratosCansados, pratoId) });
    setDetalhe(null);
    setModal(null);
  }
  function trazerDeVoltaPrato(pratoId: string) {
    aplicarRotacao({ ...perfil, pratosCansados: perfil.pratosCansados.filter((c) => c.id !== pratoId) });
  }

  function gerarOpcoesPrato(idx: number, excluir: string[]): OpcaoPrato[] {
    if (!dieta.plano || !cardTotais) return [];
    const item = cardItens[idx]!;
    // Bloqueamos os pratos das outras refeições + os já mostrados. O motor deduplica e para
    // quando o pool elegível se esgota (evita as "3 opções iguais" — o relaxe de gosto repetia).
    const outros = cardItens.filter((_, i) => i !== idx).map((c) => c.prato.id);
    return listarSubstituicoesPrato({
      pratoAtual: item.prato, slot: item.refeicao, recipes: RECIPES_SEED, foodsById: FOODS_BY_ID_SEED,
      plano: dieta.plano, totaisDiaAtual: cardTotais, escalaAtual: item.escala, restricoes,
      gosto: { excluirPratoIds: [...outros, ...excluir, ...cansadosAtivos], excluirAlimentoIds: perfil.naoCurto },
    }).map((rr) => ({ prato: rr.prato!, escala: rr.escala!, macros: rr.macrosNovo!, diaNew: rr.totaisDiaNovo! }));
  }
  const abrirTrocaPrato = (idx: number) => { const o = gerarOpcoesPrato(idx, []); setModal({ tipo: 'prato', idx, base: cardItens[idx]!.prato.nome, opcoes: o, excl: o.map((x) => x.prato.id) }); };
  const maisVariedadePrato = () => {
    if (modal?.tipo !== 'prato') return;
    let n = gerarOpcoesPrato(modal.idx, modal.excl);
    let excl = [...modal.excl, ...n.map((x) => x.prato.id)];
    if (!n.length) { n = gerarOpcoesPrato(modal.idx, []); excl = n.map((x) => x.prato.id); } // esgotou → recomeça o ciclo
    if (n.length) setModal({ ...modal, opcoes: n, excl });
  };
  function aplicarPrato(idx: number, o: OpcaoPrato) {
    const novos = cardItens.slice(); novos[idx] = { refeicao: cardItens[idx]!.refeicao, prato: o.prato, escala: o.escala, macros: o.macros };
    setCardItens(novos); setCardTotais(o.diaNew); marcar(`p${idx}`); setModal(null);
  }
  function aplicarPorcao(idx: number, f: number) {
    const item = cardItens[idx]!; const nm = escalar(item.macros, f); const novos = cardItens.slice();
    novos[idx] = { ...item, escala: item.escala * f, macros: nm }; setCardItens(novos);
    setCardTotais((prev) => prev ? { kcal: prev.kcal - item.macros.kcal + nm.kcal, proteinaG: prev.proteinaG - item.macros.proteinaG + nm.proteinaG, carboidratoG: prev.carboidratoG - item.macros.carboidratoG + nm.carboidratoG, gorduraG: prev.gorduraG - item.macros.gorduraG + nm.gorduraG } : prev);
    marcar(`p${idx}`); setModal(null);
  }
  function gerarOpcoesEx(d: number, s: number, excluir: string[]): Exercise[] {
    const atual = rotinaDias[d]!.slots[s]!.exercicio;
    // Bloqueia exercícios já usados na rotina + os já mostrados; o motor deduplica e para no fim.
    const usados = [...rotinaDias.flatMap((dia) => dia.slots.map((sl) => sl.exercicio.id)), ...excluir];
    return listarSubstituicoesExercicio({
      exercicioAtual: atual, equipamento: perfil.equipamento, equipamentosCasa: perfil.equipamentosCasa,
      nivelExperiencia: perfil.nivelExperiencia, exercises: EXERCISES_SEED, historicoRecenteIds: usados,
    }).map((rr) => rr.exercicio!);
  }
  const abrirTrocaEx = (d: number, s: number) => { const o = gerarOpcoesEx(d, s, []); setModal({ tipo: 'exercicio', d, s, base: rotinaDias[d]!.slots[s]!.exercicio.nomePt, opcoes: o, excl: o.map((e) => e.id) }); };
  const maisVariedadeEx = () => {
    if (modal?.tipo !== 'exercicio') return;
    let n = gerarOpcoesEx(modal.d, modal.s, modal.excl);
    let excl = [...modal.excl, ...n.map((e) => e.id)];
    if (!n.length) { n = gerarOpcoesEx(modal.d, modal.s, []); excl = n.map((e) => e.id); } // esgotou → recomeça o ciclo
    if (n.length) setModal({ ...modal, opcoes: n, excl });
  };
  function aplicarEx(d: number, s: number, ex: Exercise) {
    registrarEvento('exercicio_substituido', {
      de_id: rotinaDias[d]?.slots[s]?.exercicio.id ?? '', para_id: ex.id, motivo: 'escolha_usuario',
    });
    const novos = rotinaDias.map((dia) => ({ ...dia, slots: dia.slots.slice() })); novos[d]!.slots[s] = { ...novos[d]!.slots[s]!, exercicio: ex };
    setRotinaDias(novos); marcar(`e${d}-${s}`); setModal(null);
  }
  const registrarPeso = (v: number) => {
    if (!Number.isFinite(v) || v < 30 || v > 300) return;
    // A data é carimbada aqui, na UI (o motor segue clock-free) e é a MESMA que vai para o
    // servidor no campo `data` do log — é ela que permite a janela de 7 dias.
    const dia = hojeISO();
    setPesos((p) => [...p, { dataISO: dia, kg: v }]);
    registrarPesoLocal(v, dia); // cópia local primeiro (offline-first — fix 2026-07-08)
    void registrarPesoServidor(v, dia); // write-through com a data (no-op sem backend)
  };

  const prescricao = treino.prescricao;
  // Progressão viva (Bloco B): alvo por exercício + semana de alívio, derivados do histórico.
  const progresso = prescricao ? progressoDosExercicios(sessoes, prescricao, (id) => EXERCISES_SEED.find((e) => e.id === id), EXERCISES_SEED, perfil.equipamento, perfil.equipamentosCasa) : undefined;

  // --- Mesociclo v2 (DF 2026-07-08) + relógio por ATIVIDADE (Leva 1B, DF 2026-07-26) ------
  // A semana avança pelas semanas em que houve sessão REGISTRADA (guiada ou manual), não
  // pelo calendário — o v2 rampava volume/RIR de quem não treinou, violando o trilho
  // "é a execução real que dispara a progressão". O gatilho REATIVO (≥3 "difícil"/14d OU
  // botão de fadiga ≤7d) antecipa a semana 6 e grava a marca `deloadAte`.
  // `desdeISO = mesocicloInicio` impede o alívio reativo de re-disparar a si mesmo ao acabar.
  // 🔒 O relógio do mesociclo e a rampa leem só TREINO RESISTIDO — cardio fora (armadilha 2
  // do handoff da Leva 2: uma pedalada não pode subir a rampa de volume da musculação).
  const datasSessao = sessoesResistidas(sessoes).map((s) => s.dataISO);
  const sinaisFadiga = sinaisFadigaDoHistorico(sessoes, hojeISO(), perfil.mesocicloInicio ?? null);
  // Rampa de RETOMADA (Leva 2 · Bloco 3) — derivada, sem estado novo.
  const retomada = retomadaDoHistorico(sessoes, hojeISO());
  const ciclo = estadoDoCiclo({
    mesocicloInicioISO: perfil.mesocicloInicio ?? null,
    hojeISO: hojeISO(),
    sinaisFadiga,
    datasSessao,
    deloadAteISO: perfil.deloadAte ?? null,
  });
  // 🔒 A rampa SUPERSEDE o deload reativo enquanto ativa (ela já é um deload — somar os
  // dois daria 0,25 × piso, estímulo trivial; lacuna 6 da spec).
  const deloadAtivo = prescricao && !retomada ? ciclo.deload : false;
  // 🔒 Precedência DURA do "fiquei doente" (Bloco 4): rampa ativa → só o chip/cartão de
  // retomada · reconhecido → só o aviso · senão → nada. Nunca duas mensagens empilhadas.
  const avisoPausa = avisoPausaVisivel({ reconhecidoEm: perfil.reconhecidoEm, rampaAtiva: retomada != null, sessoes });
  // --- Cardio (Leva 2 · Bloco 1) -------------------------------------------------------
  // 🔒 A meta cai pelo MESMO fator da rampa, na mesma semana: deixar 150 min intactos para
  // quem volta de 60 dias com o treino cortado pela metade seria pedir de cardio o que se
  // acabou de tirar do treino. 🔒 Gate ROTEAR → sem meta (registra, mas não é orientado).
  const registrosCardioSemana = registrosDaSemana(sessoes, hojeISO());
  const metaCardio: MetaCardio | null = metaCardioComRetomada(
    metaCardioSemanal(perfil.objetivo, treino.gate.comportamento === 'ROTEAR'),
    retomada?.fator ?? null,
  );
  const propsCardio = {
    registros: registrosCardioSemana, meta: metaCardio, retomada, hojeISO: hojeISO(),
    acumuladoMin: minutosAcumulados(sessoes), objetivo: perfil.objetivo,
    onRegistrar: () => { setRegistrandoCardio(true); window.scrollTo(0, 0); },
    // 🔒 O denominador do cartão é o que o PLANO prescreve (DF 2026-08-01) — soma dos dias
    // de cardio emitidos pelo motor. Sem dia emitido, `undefined`: o cartão cai na meta.
    prescritoMin: (treino.rotina?.diasCardio ?? []).reduce((n, d) => n + (d.minutos ?? 0), 0) || undefined,
  };
  /**
   * 🔒 DIA EXCEDENTE = DIA DE CARDIO (Leva E, spec §🏃). O motor conta esses dias desde
   * sempre (`diasCardioRecuperacao`) e nunca construía nada — a pessoa era informada de N
   * dias de cardio e não recebia item nenhum. É o que mantinha a entrada unificada dormente.
   *
   * ⚠️ A meta que entra é a JÁ ESCALADA pela rampa: na retomada o dia existe com duração
   * menor, sem regra nova. E `sessoesFeitas` só é lida na meta em sessões (massa).
   */
  /**
   * 🔒 O PORTÃO das técnicas avançadas (Leva F, §🥊) — resolvido UMA vez, aqui, e distribuído.
   * O Editar perfil e a sessão guiada leem o MESMO valor: duas resoluções seriam duas
   * respostas para "quem pode", e uma delas envelheceria em silêncio.
   * 🔴 `ligado: true` na consulta porque a pergunta aqui é "o portão liberaria?"; o opt-in
   * da pessoa entra logo abaixo, na conjunção.
   */
  const portaoTecnicas = elegibilidade({
    nivel: perfil.nivelExperiencia,
    sessoesResistidas: sessoesResistidas(sessoes).length,
    comportamentoGate: dieta.gate.comportamento,
    regressaoAtiva: [...feedbackAgregadoPorGrupo(sessoes, hojeISO(), (id) => EXERCISES_SEED.find((e) => e.id === id)).values()].some((f) => f === 'segura'),
    ligado: true,
  }).elegivel;
  const tecnicasLiberadas = portaoTecnicas && (perfil.tecnicasAvancadas ?? false);
  const diaExcedente = conteudoDoDiaExcedente({
    meta: metaCardio,
    diasExcedentes: treino.rotina?.diasCardioRecuperacao ?? 0,
    roteado: treino.gate.comportamento === 'ROTEAR',
    sessoesFeitas: resumoCardioSemana(registrosCardioSemana).sessoesNaMeta,
  });
  /**
   * 🔒 A SESSÃO DE **HOJE** — fonte única com a faixa "Sua semana" (DF 2026-08-04).
   *
   * 🔴 Aqui morava a contradição medida em produção: o cartão "Treino de hoje" e o seu botão
   * liam `rotinaDias[0]` — a 1ª sessão da rotina, SEMPRE —, enquanto a faixa mapeava o dia do
   * calendário. Numa terça de seg/ter/qui/sex a faixa dizia *Lower A* e o cartão dizia
   * *Upper A*; o cartão acertava 1 dia em 7 e, no descanso, anunciava treino que não havia.
   * Pior que o rótulo: "Começar treino" ABRIA a sessão errada, carimbando `sessao_iniciada`
   * na sessão que a pessoa não fez.
   *
   * `null` = hoje não é dia de treino → o cartão não é montado (quem fala do descanso é a
   * faixa, que já traz "Ver próximo treino").
   */
  const sessaoHojeIdx = sessaoDeHojeIdx(
    perfil.treinoDias ?? [],
    rotinaDias.map((d) => d.nome),
    weekdayHojeIdx(),
    treino.rotina?.diasCardio ?? [],
  );
  const diaDeHoje = sessaoHojeIdx != null ? rotinaDias[sessaoHojeIdx] : undefined;

  /** Opções da semana p/ o montador (rampa + feedback agregado por grupo — v2 §1/§6). */
  function opcoesDaSemana() {
    const base = {
      semana: ciclo.semanaEfetiva,
      feedbackGrupos: feedbackAgregadoPorGrupo(lerHistorico(), hojeISO(), (id) => EXERCISES_SEED.find((e) => e.id === id)),
    };
    if (!retomada || !prescricao) return base;
    // Volume de REFERÊNCIA = alvo da última semana efetivamente treinada (o corpo se
    // adaptou ao último estímulo real, não ao de dois anos atrás).
    const datas = sessoesResistidas(sessoes).map((s) => s.dataISO).sort();
    const ultima = datas[datas.length - 1];
    const semanaRef = ultima && perfil.mesocicloInicio
      ? semanaDoCiclo(perfil.mesocicloInicio, ultima, datas)
      : 1;
    return {
      ...base,
      retomada: {
        semana: retomada.semana,
        fator: retomada.fator,
        volumeReferencia: alvoDaSemana(prescricao.volumePorGrupoSemana, semanaRef),
        exerciciosRecentes: exerciciosRecentes(sessoes),
      },
    };
  }
  // Persiste a âncora nova (1º uso / deload reativo) + o espelho da semana (spec §7) —
  // idempotente: só grava quando algo mudou (evita loop de render).
  useEffect(() => {
    const ancora = ciclo.novaAncoraISO ?? perfil.mesocicloInicio;
    if (!ancora) return;
    const deloadAte = ciclo.novoDeloadAteISO ?? perfil.deloadAte;
    const igual = ancora === perfil.mesocicloInicio
      && deloadAte === perfil.deloadAte;
    if (igual) return;
    const novo = {
      ...perfil,
      mesocicloInicio: ancora,
      ...(deloadAte ? { deloadAte } : {}),
    };
    setPerfil(novo);
    onPerfilChange?.(novo);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gravação idempotente da âncora
  }, [ciclo.novaAncoraISO, ciclo.novoDeloadAteISO, ciclo.semanaEfetiva]);
  // Rampa de volume da semana (v2 §1): re-monta a rotina com as séries por slot da semana
  // corrente + feedback agregado por grupo. Roda no mount e quando a semana muda (não em
  // cada registro — troca manual de exercício não é clobrada no meio do uso).
  useEffect(() => {
    const { treino: nt } = recomputarPlano(perfil, { semanaCiclo: opcoesDaSemana(), pesoEfetivoKg: pesoMotorKg });
    setTreino(nt);
    setRotinaDias(nt.rotina?.dias ?? []);
    // Re-monta quando a semana do ciclo OU a rampa de retomada muda. A rampa entra nas deps
    // porque ela nasce depois da hidratação do histórico e pode coincidir com a MESMA semana
    // de ciclo — sem isto, a rotina ficaria com o volume cheio enquanto o chip já diz
    // "Retomada" (bug real, pego no smoke do Bloco 3).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ciclo.semanaEfetiva, retomada?.semana, retomada?.fator, pesoMotorKg]);
  /**
   * 🔒 A DIETA SEGUE O PESO (Leva D, DF 2026-07-31). Quando a âncora se move — e ela só se
   * move com ≥ 1 kg / 1,5% E ≥ 1 semana desde a última —, o cardápio e o alvo são regerados.
   *
   * ⚠️ Fail-safe idêntico ao de `recalcular`: se o novo peso cair em ROTEAR (ex.: IMC < 16), o
   * plano válido de antes NÃO é substituído — a tela de encaminhamento aparece. O gate vale
   * retroativamente; suprimi-lo aqui seria deixar a pessoa dentro de um plano que o gate já
   * recusaria. 🔴 Isto NÃO é adaptar o plano "à condição": é o app dar um passo atrás.
   */
  useEffect(() => {
    if (pesoAplicadoRef.current === pesoMotorKg) return;
    pesoAplicadoRef.current = pesoMotorKg;
    const { dieta: nd } = recomputarPlano(perfil, { pesoEfetivoKg: pesoMotorKg });
    if (nd.gate.comportamento === 'ROTEAR' || !nd.plano) {
      setEncaminhamento(nd.gate.motivos ?? []);
      return;
    }
    setDieta(nd);
    setCardItens(nd.cardapio?.itens ?? []);
    setCardTotais(nd.cardapio?.totais ?? null);
    setMostrarC(nd.gate.comportamento === 'RESTRINGIR' || nd.gate.comportamento === 'PISAR');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só a âncora dispara
  }, [pesoMotorKg]);
  // Prescrição EFETIVA da semana p/ a sessão (RIR-alvo da rampa 3→1 + descanso do composto
  // até ~180 s quando o tempo permite — o montador decide e devolve em rotina.semana).
  const prescricaoBase = prescricao
    ? {
        ...prescricao,
        rirAlvoSemana: rirAlvoDaSemana(prescricao.rir, ciclo.semanaEfetiva),
        descansoCompostoSeg: treino.rotina?.semana?.descansoCompostoSeg ?? prescricao.descansoCompostoSeg,
      }
    : null;
  // 🔴 Na rampa o RIR-alvo é 3 (piso da escada), NUNCA o RIR da semana em que a pessoa
  // parou — e o descanso mínimo sobe (120 s / 90 s), elevando inclusive o do isolado.
  const prescricaoEfetiva = prescricaoBase && retomada
    ? aplicarRetomada(prescricaoBase, retomada.semana)
    : prescricaoBase;
  // Botão de fadiga (v2 §6): grava o evento (não conta dia de treino) → o deload reativo
  // dispara na hora (sinaisFadiga → estadoDoCiclo antecipa a semana 6 e reancora).
  function sinalizarFadiga() {
    aplicarNovoHistorico(registrarSinalFadiga());
  }
  const tabs: { id: Aba; label: string }[] = [{ id: 'hoje', label: 'Hoje' }, { id: 'treino', label: 'Treino' }, { id: 'dieta', label: 'Dieta' }, { id: 'progresso', label: 'Progresso' }, { id: 'historico', label: 'Histórico' }, { id: 'perfil', label: 'Perfil' }];
  // 🔒 As 6 abas ficam em MODO DIÁRIO: todas continuam com conteúdo real (registro ou leitura
  // do registro). Sumir com abas seria o "cadeado" que a DF proíbe — o que some é o conteúdo
  // de prescrição dentro delas, não a navegação.
  const registradoHoje = {
    treinos: sessoesTreino(sessoes).filter((s) => s.dataISO === hojeISO()).length,
    // Minutos CRUS do dia (o que ela fez), não os "minutos na meta" — não há meta aqui.
    cardioMin: registrosCardioSemana.filter((r) => r.dataISO === hojeISO()).reduce((m, r) => m + r.minutos, 0),
    refeicoesRegistradas: refeicoesDia.filter((r) => registro.logs[r]).length,
  };
  const irAba = (id: Aba) => { setVista(null); setAba(id); };

  // Edição entrou em zona clínica (ROTEAR) → encaminhamento (tela cheia, fail-safe).
  // Não aplicamos o plano nem mexemos na sessão: o plano válido anterior segue intacto.
  if (encaminhamento) {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB' }}>
        <Backdrop />
        <EncaminhamentoEdicao motivos={encaminhamento} onRevisar={() => { setEncaminhamento(null); setEditando(true); }} onManter={() => setEncaminhamento(null)} />
      </div>
    );
  }

  // Editar perfil (tela cheia) → recalcular o plano.
  if (editando) {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB' }}>
        <Backdrop />
        {/* 🔒 Os insumos do PORTÃO das técnicas avançadas (Leva F, §🥊) vêm DAQUI: quem tem
            o histórico é o Painel. A tela não conta sessão nem lê gate por conta própria —
            se contasse, existiriam duas respostas para "quem é elegível". */}
        <EditarPerfil
          inicial={perfil}
          onCancelar={() => setEditando(false)}
          onSalvar={recalcular}
          modoDiario={modoDiario}
          sessoesResistidas={sessoesResistidas(sessoes).length}
          comportamentoGate={dieta.gate.comportamento}
          regressaoAtiva={[...feedbackAgregadoPorGrupo(sessoes, hojeISO(), (id) => EXERCISES_SEED.find((e) => e.id === id)).values()].some((f) => f === 'segura')}
        />
      </div>
    );
  }

  // Registrar treino feito (tela cheia, fora do shell — mesmo padrão da sessão guiada).
  if (registrando) {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB' }}>
        <Backdrop />
        <RegistrarTreino
          diaHoje={diaDeHoje}
          prescricao={prescricaoEfetiva}
          progresso={progresso}
          exercicioPorId={(id) => EXERCISES_SEED.find((e) => e.id === id)}
          onCalibrar={calibrarExercicios}
          onCancelar={() => setRegistrando(false)}
          onSalvar={salvarTreinoManual}
          onVerHistorico={() => { setRegistrando(false); setAba('historico'); window.scrollTo(0, 0); }}
        />
      </div>
    );
  }

  // Registrar CARDIO (Leva 2 · Bloco 1) — tela cheia, mesmo padrão do registro manual.
  if (registrandoCardio) {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB', padding: '32px 20px 60px' }}>
        <Backdrop />
        <RegistrarCardio
          pesoKg={perfil.pesoKg}
          modalidadeInicial={cardioPre?.modalidade as ModalidadeCardio | undefined}
          minutosInicial={cardioPre?.minutos ?? undefined}
          onSalvar={salvarCardio}
          onCancelar={() => { setCardioPre(null); setRegistrandoCardio(false); }}
        />
      </div>
    );
  }

  // Sessão de treino guiada (tela cheia, fora do shell do painel).
  if (sessaoDia !== null && prescricaoEfetiva && rotinaDias[sessaoDia]) {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB' }}>
        <Backdrop />
        <SessaoTreino dia={rotinaDias[sessaoDia]!} prescricao={prescricaoEfetiva} progresso={progresso} deload={deloadAtivo} exercicioPorId={(id) => EXERCISES_SEED.find((e) => e.id === id)} onCalibrar={calibrarExercicios} onSair={() => setSessaoDia(null)} onConcluir={concluirSessao} onRegistrarCardio={salvarCardio} pesoKg={perfil.pesoKg} tecnicasLiberadas={tecnicasLiberadas} />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB', animation: `evkScreenIn .5s ${EASE}` }}>
      <Backdrop />
      {/* header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(13,40,24,.82)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(234,229,219,.1)' }}>
        <div className="evk-painel-topo" style={{ maxWidth: 1080, margin: '0 auto', padding: '13px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="evk-painel-marca" style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}><Logo size={26} /><Marca size="1.1rem" /></div>
          <nav className="evk-painel-tabs" style={{ flex: 1, minWidth: 0, display: 'flex', gap: 4, overflowX: 'auto', padding: '2px 4px' }}>
            {tabs.map((t) => (
              <div key={t.id} className="evk-painel-tab" onClick={() => irAba(t.id)} style={{ cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 11, fontWeight: 600, fontSize: '.94rem', transition: 'all .25s ease', borderWidth: 1, borderStyle: 'solid', ...(aba === t.id && !vista ? { background: 'rgba(189,255,0,.12)', color: '#BDFF00', borderColor: 'rgba(189,255,0,.3)' } : { color: 'rgba(234,229,219,.62)', borderColor: 'transparent' }) }}>{t.label}</div>
            ))}
          </nav>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setMenu((m) => !m)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.12)', borderRadius: 999, padding: '5px 12px 5px 5px', cursor: 'pointer' }}>
              <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(189,255,0,.16)', color: '#BDFF00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.92rem' }}>{inicial}</span>
              <svg width={14} height={14} viewBox="0 0 24 24" style={{ color: 'rgba(234,229,219,.5)' }}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {menu && (
              <div style={{ position: 'absolute', top: 48, right: 0, width: 180, background: '#10241a', border: '1px solid rgba(234,229,219,.14)', borderRadius: 14, padding: 7, boxShadow: '0 24px 50px -20px rgba(0,0,0,.7)', animation: `evkPop .25s ease`, zIndex: 60 }}>
                <button onClick={() => { irAba('perfil'); setMenu(false); }} style={menuBtn(false)}>Meu perfil</button>
                <button onClick={() => { setEditando(true); setMenu(false); }} style={menuBtn(false)}>Editar perfil</button>
                <button onClick={() => { router.push('/conta'); }} style={menuBtn(false)}>Conta e meus dados</button>
                {/* Lista de compras é parte do CARDÁPIO — some em modo diário (sem cadeado,
                    sem item desabilitado: o item simplesmente não existe). */}
                {!modoDiario && <button onClick={() => { setVista('compras'); setAba('dieta'); setMenu(false); }} style={menuBtn(false)}>Lista de compras</button>}
                <button onClick={onSair} style={menuBtn(true)}>Sair</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1080, margin: '0 auto', padding: '36px 22px 90px' }}>
        {/* Contador de treinos (chama dos 4 marcos) — PRIMEIRO elemento da Hoje, acima da
            saudação (handoff §Posição). Substitui o indicador de marco 7/30 que ficava abaixo. */}
        {!vista && aba === 'hoje' && <ContadorTreinos dias={diasTreinados} celebrarToken={celebrarToken} modoDiario={modoDiario} />}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 800, letterSpacing: '-.02em' }}>Bom treino 👊</h1>
          <p style={{ margin: 0, color: 'rgba(234,229,219,.55)', fontSize: '.98rem' }}>{dataHoje || 'Seu dia'}</p>
        </div>

        {vista === 'compras' && <ListaCompras itens={cardItens} foodsById={FOODS_BY_ID_SEED} onVoltar={() => setVista(null)} />}
        {/* 🔒 MODO DIÁRIO — a Hoje é a porta do DIÁRIO, não o plano do dia (que não existe).
            Decisão da sessão de código: o cofre não especificou esta tela. Ver ModoDiario.tsx. */}
        {!vista && aba === 'hoje' && modoDiario && (
          <HojeDiario
            registrado={registradoHoje}
            onRegistrarTreino={() => setRegistrando(true)}
            onRegistrarCardio={() => { setRegistrandoCardio(true); window.scrollTo(0, 0); }}
            onRegistrarRefeicao={() => irAba('dieta')}
            pesoSlot={<RegistrarPesoRow onRegistrar={registrarPeso} />}
          />
        )}
        {!vista && aba === 'hoje' && !modoDiario && (
          <div style={sec}>
            <SuaSemana
              treinoDias={perfil.treinoDias}
              sessoesNomes={rotinaDias.map((d) => d.nome)}
              onIrSessao={(idx) => (rotinaDias[idx] ? iniciarSessaoGuiada(idx) : setAba('treino'))}
              onVerDieta={() => irAba('dieta')}
              onEditarPerfil={() => setEditando(true)}
              diaExcedente={diaExcedente}
              diasCardio={treino.rotina?.diasCardio ?? []}
              onRegistrarCardio={(item) => { setCardioPre(item ?? null); setRegistrandoCardio(true); window.scrollTo(0, 0); }}
            />
            <Hoje dieta={dieta} cardTotais={cardTotais} dia={diaDeHoje} mostrarC={mostrarC} onFecharC={() => setMostrarC(false)} onComecar={() => sessaoHojeIdx != null ? iniciarSessaoGuiada(sessaoHojeIdx) : setAba('treino')} onRegistrar={registrarPeso} onRegistrarTreino={() => setRegistrando(true)} deload={deloadAtivo} semanaCiclo={ciclo.semanaEfetiva} onSinalFadiga={sinalizarFadiga} retomada={retomada} />
          </div>
        )}
        {/* 🔒 O cardio aparece mesmo SEM prescrição: quem o gate roteou "registra, mas não
            recebe meta". Sem este ramo, o usuário em ROTEAR veria a aba Treino VAZIA e não
            teria onde registrar — o oposto do que a spec pede. */}
        {!vista && aba === 'treino' && (prescricao
          ? <TreinoTab dias={rotinaDias} prescricao={prescricao} treinoNome={treino.rotina?.split ?? 'Treino'} trocados={trocados} feedback={feedback} progresso={progresso} favoritos={favoritosSet} onToggleFavorito={toggleFavorito} onTrocar={abrirTrocaEx} onFb={(k, f) => setFeedback((p) => ({ ...p, [k]: f }))} onIniciar={(d) => iniciarSessaoGuiada(d)} onDetalhe={(d, s) => setDetalhe({ tipo: 'ex', d, s })} onRegistrarTreino={() => setRegistrando(true)} avisoPausa={avisoPausa} onReconhecerPausa={reconhecerPausa} cardio={propsCardio} />
          : (
            <div style={sec}>
              {/* 🔒 Sem prescrição a aba Treino é só REGISTRO — o botão de registro manual
                  mora dentro da TreinoTab, então em modo diário ele precisa existir aqui.
                  Sem isto, o roteado ficaria sem onde registrar treino: o oposto da DF. */}
              <TreinoDiario onRegistrarTreino={() => setRegistrando(true)} />
              <CardioSemana {...propsCardio} />
            </div>
          ))}
        {/* 🔒 MODO DIÁRIO: a aba Dieta é só o registro das 4 refeições — sem cardápio, sem
            prato, sem `~X kcal`, sem macro, sem troca e sem lista de compras (tudo plano). */}
        {!vista && aba === 'dieta' && modoDiario && (
          <DietaDiario logs={registro.logs} notes={registro.notes} onStatus={registro.setStatus} onNote={registro.setNote} />
        )}
        {!vista && aba === 'dieta' && !modoDiario && <DietaTab dieta={dieta} itens={cardItens} totais={cardTotais} trocados={trocados} logs={registro.logs} notes={registro.notes} dataHoje={dataHoje} onStatus={registro.setStatus} onNote={registro.setNote} onTrocar={abrirTrocaPrato} onPorcao={(idx) => setModal({ tipo: 'porcao', idx, base: cardItens[idx]!.prato.nome })} onCompras={() => setVista('compras')} onDetalhe={(idx) => setDetalhe({ tipo: 'prato', idx })} descanso={pratosDescanso} onTrazerDeVolta={trazerDeVoltaPrato} />}
        {!vista && aba === 'progresso' && (
          <Progresso pesos={pesosKg} treinos={sessoesTreino(sessoes).length || Object.keys(feedback).length} onRegistrar={registrarPeso} modoDiario={modoDiario} notaPesoPlano={notaPesoPlano}>
            {/* Frequência por grupo (Leva 2 · Bloco 2) — aba Progresso, como o design pede.
                `diasForca` = dias de FORÇA agendados: é ele que liga (ou não) a régua de 2×. */}
            <FrequenciaGrupos
              sessoes={sessoes}
              exercicioPorId={(id) => EXERCISES_SEED.find((e) => e.id === id)}
              hojeISO={hojeISO()}
              diasForca={rotinaDias.length || perfil.treinoDias.length}
              objetivo={perfil.objetivo}
              retomadaAtiva={retomada != null}
              modoDiario={modoDiario}
              onVerTreino={() => { setAba('treino'); window.scrollTo(0, 0); }}
            />
          </Progresso>
        )}
        {!vista && aba === 'historico' && <Historico sessoes={sessoes} pesos={pesosKg} refeicoes={refeicoesDia} logs={registro.logs} notes={registro.notes} onAbrir={(s) => setDetalheSessao(s)} onComecarTreino={() => modoDiario ? setRegistrando(true) : rotinaDias[0] ? iniciarSessaoGuiada(0) : setAba('treino')} onVerDieta={() => irAba('dieta')} onRegistrarTreino={() => setRegistrando(true)} modoDiario={modoDiario} />}
        {!vista && aba === 'perfil' && <Perfil perfil={perfil} onConta={() => router.push('/conta')} onEditar={() => setEditando(true)} modoDiario={modoDiario} />}
      </div>

      {modal && <ModalTroca modal={modal} onFechar={() => setModal(null)} onAplicarPrato={aplicarPrato} onMaisPrato={maisVariedadePrato} onAplicarPorcao={aplicarPorcao} onAplicarEx={aplicarEx} onMaisEx={maisVariedadeEx} />}
      {detalhe?.tipo === 'prato' && cardItens[detalhe.idx] && (
        <DetalhePrato item={cardItens[detalhe.idx]!} foodsById={FOODS_BY_ID_SEED} onFechar={() => setDetalhe(null)} onTrocar={() => { const idx = detalhe.idx; setDetalhe(null); abrirTrocaPrato(idx); }} onPorcao={() => { const idx = detalhe.idx; setDetalhe(null); setModal({ tipo: 'porcao', idx, base: cardItens[idx]!.prato.nome }); }} onCansei={() => cansarDoPrato(cardItens[detalhe.idx]!.prato.id)} />
      )}
      {detalhe?.tipo === 'ex' && rotinaDias[detalhe.d]?.slots[detalhe.s] && (
        <DetalheExercicio
          ex={exercicioEfetivo(rotinaDias[detalhe.d]!.slots[detalhe.s]!.exercicio.id, progresso, (id) => EXERCISES_SEED.find((e) => e.id === id)) ?? rotinaDias[detalhe.d]!.slots[detalhe.s]!.exercicio}
          favoritado={favoritosSet.has(rotinaDias[detalhe.d]!.slots[detalhe.s]!.exercicio.id)}
          onToggleFavorito={() => toggleFavorito(rotinaDias[detalhe.d]!.slots[detalhe.s]!.exercicio.id)}
          onFechar={() => setDetalhe(null)}
          onTrocar={() => { const { d, s } = detalhe; setDetalhe(null); abrirTrocaEx(d, s); }}
        />
      )}
      {detalheSessao && <DetalheSessao sessao={detalheSessao} rotulo={detalheSessao.manual ? fmtDataCurta(detalheSessao.dataISO) : `Sessão ${detalheSessao.n}`} onFechar={() => setDetalheSessao(null)} />}
    </div>
  );
}

/* ════════════════════ Retomada ════════════════════ */

/**
 * Cartão da rampa de retomada (Leva 2 · Bloco 3). A rampa DERRUBA o volume do plano, e
 * volume que cai em silêncio é lido como "o app quebrou" — pior ainda em quem está
 * voltando. Tom: sem culpa, sem vermelho, sem mencionar a ausência nem contar dias.
 *
 * 🔴 A copy VARIA POR FAIXA: a frase do volume plasmático é verdadeira nos primeiros
 * ~12–21 dias e FALSA depois de meses parado — tranquilizar ali seria errar por otimismo,
 * o mesmo erro da indústria que a marca rejeita, com o sinal trocado.
 * 🔒 "o PESO em cada série continua o mesmo" (nunca "o esforço"): com o RIR-alvo em 3 o
 * esforço por série CAI — o que não muda é a carga, e é ela que a pessoa teme perder.
 */
function CartaoRetomada({ estado }: { estado: EstadoRetomada }) {
  const curta = estado.faixa === 'curta';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'linear-gradient(165deg, rgba(22,163,74,.12), rgba(15,15,14,.5))', border: '1px solid rgba(189,255,0,.28)', borderRadius: 16, padding: '14px 16px', marginBottom: 18 }}>
      <span style={{ width: 34, height: 34, minWidth: 34, borderRadius: 10, background: 'rgba(189,255,0,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3z" stroke="#BDFF00" strokeWidth={1.7} strokeLinejoin="round" /></svg>
      </span>
      <div>
        <div style={{ fontWeight: 700, fontSize: '.95rem', color: '#BDFF00', marginBottom: 2 }}>Voltando com calma</div>
        <p style={{ margin: 0, fontSize: '.86rem', color: 'rgba(234,229,219,.7)', lineHeight: 1.5 }}>
          Esta fase entra com menos séries — <strong style={{ color: 'rgba(234,229,219,.9)', fontWeight: 600 }}>o peso em cada série continua o mesmo</strong>. Só o volume caiu nesta fase.
          {curta
            ? ' Boa parte do que parece perdido no primeiro mês é volume de sangue, glicogênio e água, e volta rápido.'
            : ' O plano sobe de novo a cada semana, até voltar ao ciclo normal.'}
        </p>
      </div>
    </div>
  );
}

/* ════════════════════ Hoje ════════════════════ */

function Hoje({ dieta, cardTotais, dia, mostrarC, onFecharC, onComecar, onRegistrar, onRegistrarTreino, deload, semanaCiclo, onSinalFadiga, retomada }: {
  dieta: ResultadoMotor; cardTotais: RecipeMacros | null; dia: DiaTreino | undefined;
  mostrarC: boolean; onFecharC: () => void; onComecar: () => void; onRegistrar: (v: number) => void;
  onRegistrarTreino: () => void; deload: boolean;
  /** Semana do mesociclo (v2 §6): contador "Semana X/6 do ciclo". */
  semanaCiclo?: number;
  /** Botão de fadiga (v2 §6): dispara o deload reativo (antecipa a semana de alívio). */
  onSinalFadiga?: () => void;
  /** Rampa de retomada ativa (Leva 2 · Bloco 3) — substitui o contador do mesociclo. */
  retomada?: EstadoRetomada | null;
}) {
  const plano = dieta.plano!;
  const kcal = r0(cardTotais?.kcal ?? plano.kcalAlvo);
  const totK = plano.macros.kcalProteina + plano.macros.kcalCarboidrato + plano.macros.kcalGordura || 1;
  // Confirmação do sinal de fadiga (tom acolhedor, SEM vermelho — fadiga ≠ dor/lesão).
  const [fadigaOpen, setFadigaOpen] = useState(false);
  return (
    <div style={sec}>
      {mostrarC && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, background: 'rgba(189,255,0,.07)', border: '1px solid rgba(189,255,0,.3)', borderRadius: 16, padding: '16px 18px', marginBottom: 20 }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx={12} cy={12} r={9} stroke="#BDFF00" strokeWidth={1.8} /><path d="M12 8v5" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" /><circle cx={12} cy={16.2} r={1.1} fill="#BDFF00" /></svg>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: '.96rem', marginBottom: 3, color: '#BDFF00' }}>Um ajuste honesto no seu plano</div><p style={{ margin: 0, fontSize: '.92rem', color: 'rgba(234,229,219,.75)', lineHeight: 1.55 }}>{plano.notaTransparencia ?? (plano.avisos[0] ?? 'Ajustamos seu plano para manter você em segurança. Tudo continua editável.')}</p></div>
          <button onClick={onFecharC} style={{ background: 'none', border: 'none', color: 'rgba(234,229,219,.5)', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1, padding: 2 }}>×</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 18, marginBottom: 18 }}>
        {dia && (
          <div style={gradCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
              <span style={kicker}>Treino de hoje</span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {/* Durante a RETOMADA o "Semana X/6" não tem valor válido (o ciclo só recomeça
                    depois dela) — estado próprio, minúscula em "semana" (forma padrão). */}
                {retomada
                  ? <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#BDFF00', background: 'rgba(189,255,0,.1)', border: '1px solid rgba(189,255,0,.3)', borderRadius: 999, padding: '3px 10px' }}>Retomada · semana {retomada.semana} de {retomada.totalSemanas}</span>
                  : semanaCiclo != null && <span style={{ fontSize: '.72rem', fontWeight: 600, color: 'rgba(234,229,219,.7)', background: 'rgba(234,229,219,.07)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 999, padding: '3px 10px' }}>Semana {semanaCiclo}/6 do ciclo</span>}
                {deload && !retomada && <span style={{ fontSize: '.72rem', fontWeight: 700, color: '#BDFF00', background: 'rgba(189,255,0,.1)', border: '1px solid rgba(189,255,0,.3)', borderRadius: 999, padding: '3px 10px' }}>Semana de alívio</span>}
              </span>
            </div>
            <div style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-.02em', marginBottom: 6 }}>{dia.nome}</div>
            <div style={{ color: 'rgba(234,229,219,.6)', fontSize: '.95rem', marginBottom: 22 }}>{dia.slots.length} exercícios{deload && !retomada ? ' · séries reduzidas esta semana' : ''}</div>
            {retomada && <CartaoRetomada estado={retomada} />}
            {/* Entrada A1 do registro manual (handoff): botão ao lado de "Começar treino". */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={onComecar} className="hov-btn" style={{ flex: 2, minWidth: 150, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1rem', padding: 14, border: 'none', borderRadius: 12, cursor: 'pointer' }}>Começar treino</button>
              <button onClick={onRegistrarTreino} className="evk-registrar" style={{ flex: 1, minWidth: 170, background: 'none', border: '1px solid rgba(189,255,0,.4)', color: '#BDFF00', fontWeight: 600, fontSize: '.9rem', padding: 14, borderRadius: 12, cursor: 'pointer' }}>Já treinei — registrar</button>
            </div>
            {/* Botão de fadiga (v2 §6): gatilho do deload REATIVO. Some quando o alívio já está ativo. */}
            {onSinalFadiga && !deload && (
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <button onClick={() => setFadigaOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', color: 'rgba(234,229,219,.6)', fontWeight: 600, fontSize: '.84rem', padding: 6, cursor: 'pointer', textDecoration: 'underline' }}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-2 5 5 0 0 1 9 2c-2 4.5-9 9-9 9z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" /></svg>
                  Estou exausto / muito dolorido
                </button>
              </div>
            )}
          </div>
        )}
        {/* Confirmação do sinal de fadiga — tom acolhedor, sem vermelho (fadiga ≠ dor/lesão). */}
        {fadigaOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }} onClick={() => setFadigaOpen(false)}>
            <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, width: '100%', background: '#10241a', border: '1px solid rgba(189,255,0,.28)', borderRadius: 18, padding: '22px 22px 18px', animation: `evkPop .3s ${EASE}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 34, height: 34, minWidth: 34, borderRadius: 10, background: 'rgba(189,255,0,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={18} height={18} viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-2 5 5 0 0 1 9 2c-2 4.5-9 9-9 9z" stroke="#BDFF00" strokeWidth={1.7} strokeLinejoin="round" /></svg></span>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#BDFF00' }}>Vamos aliviar esta semana?</div>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: '.9rem', color: 'rgba(234,229,219,.75)', lineHeight: 1.55 }}>Cansaço acumulado faz parte do processo. Se você está exausto ou muito dolorido, antecipamos a <strong style={{ color: 'rgba(234,229,219,.9)', fontWeight: 600 }}>semana de alívio</strong>: menos séries e ~10% menos carga por uma semana — depois um ciclo novo começa.</p>
              <p style={{ margin: '0 0 16px', fontSize: '.8rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.5 }}>Se for dor localizada (não só cansaço), use o &quot;Senti dor&quot; do exercício e procure um profissional.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setFadigaOpen(false)} style={{ flex: 1, background: 'rgba(234,229,219,.06)', border: '1px solid rgba(234,229,219,.16)', color: '#EAE5DB', fontWeight: 600, fontSize: '.9rem', padding: 12, borderRadius: 11, cursor: 'pointer' }}>Agora não</button>
                <button onClick={() => { setFadigaOpen(false); onSinalFadiga?.(); }} style={{ flex: 1.4, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.9rem', padding: 12, border: 'none', borderRadius: 11, cursor: 'pointer' }}>Ativar semana de alívio</button>
              </div>
            </div>
          </div>
        )}
        <div style={gradCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><span style={kicker}>Dieta de hoje</span></div>
          <div style={{ fontSize: '.8rem', color: 'rgba(234,229,219,.5)', marginBottom: 2 }}>Seu ponto de partida</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 18 }}><span style={{ fontSize: '2rem', fontWeight: 800, color: '#BDFF00', letterSpacing: '-.02em' }}>{kcal}</span><span style={{ fontSize: '.95rem', color: 'rgba(234,229,219,.55)' }}>kcal</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 14 }}>
            <Barra nome="Proteína" g={r0(plano.macros.proteinaG)} pct={Math.round(plano.macros.kcalProteina / totK * 100)} cor="#BDFF00" />
            <Barra nome="Carboidrato" g={r0(plano.macros.carboidratoG)} pct={Math.round(plano.macros.kcalCarboidrato / totK * 100)} cor="#16A34A" />
            <Barra nome="Gordura" g={r0(plano.macros.gorduraG)} pct={Math.round(plano.macros.kcalGordura / totK * 100)} cor="rgba(234,229,219,.4)" />
          </div>
          <p style={{ margin: 0, fontSize: '.82rem', color: 'rgba(234,229,219,.5)' }}>É um guia, não uma meta exata.</p>
        </div>
      </div>
      <RegistrarPesoRow onRegistrar={onRegistrar} />
    </div>
  );
}

/* ════════════════════ Treino ════════════════════ */

function TreinoTab({ dias, prescricao, treinoNome, trocados, feedback, progresso, favoritos, onToggleFavorito, onTrocar, onFb, onIniciar, onDetalhe, onRegistrarTreino, avisoPausa, onReconhecerPausa, cardio }: {
  dias: DiaTreino[]; prescricao: NonNullable<ResultadoTreino['prescricao']>; treinoNome: string;
  trocados: Set<string>; feedback: Record<string, Feedback>; progresso?: Record<string, ProgressoExercicio>;
  favoritos: Set<string>; onToggleFavorito: (id: string) => void;
  onTrocar: (d: number, s: number) => void; onFb: (k: string, f: Feedback) => void;
  onIniciar: (d: number) => void; onDetalhe: (d: number, s: number) => void; onRegistrarTreino: () => void;
  /** "Fiquei doente" (Bloco 4): aviso "Pausa reconhecida" — já resolvido pela precedência. */
  avisoPausa: boolean; onReconhecerPausa: () => void;
  /** Cardio (Bloco 1): a seção da semana mora na aba Treino, como o design desenhou. */
  cardio: {
    registros: readonly RegistroCardioDatado[]; meta: MetaCardio | null;
    retomada?: { semana: number; totalSemanas: number } | null;
    hojeISO: string; acumuladoMin: number; objetivo: PerfilResumo['objetivo']; onRegistrar: () => void;
  };
}) {
  const total = dias.reduce((n, d) => n + d.slots.length, 0);
  return (
    <div style={sec}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        <div><div style={{ ...kicker, color: '#BDFF00', marginBottom: 6 }}>Plano de treino</div><h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-.02em' }}>{treinoNome}</h2></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.55)', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 999, padding: '7px 14px' }}>{total} exercícios</span>
          {/* Entrada A2 do registro manual (handoff): no header da aba Treino. */}
          <button onClick={onRegistrarTreino} className="evk-registrar" style={{ background: 'none', border: '1px solid rgba(189,255,0,.4)', color: '#BDFF00', fontWeight: 600, fontSize: '.94rem', padding: '12px 20px', borderRadius: 12, cursor: 'pointer' }}>Já treinei — registrar</button>
        </div>
      </div>
      {/* O aviso entra entre o cabeçalho da aba e a lista — e a lista abaixo é EXATAMENTE a
          mesma de quem não avisou (nada avançou, nada foi remarcado). */}
      {avisoPausa && <AvisoPausaReconhecida />}
      {dias.map((dia, d) => (
        <div key={`${dia.nome}-${d}`} style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div style={kicker}>{dia.nome} · RIR {prescricao.rir.min}–{prescricao.rir.max}</div>
            <button onClick={() => onIniciar(d)} className="hov-btn" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '.85rem', padding: '8px 16px', border: 'none', borderRadius: 10, cursor: 'pointer' }}><svg width={13} height={13} viewBox="0 0 24 24" fill="none"><path d="M6 4l14 8-14 8V4z" fill="currentColor" /></svg>Iniciar treino</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {dia.slots.map((sl, s) => {
              const comp = sl.padrao !== 'isolado';
              const reps = comp ? prescricao.repsComposto : prescricao.repsIsolado;
              // 🔒 Prévia do plano: mesmo número que a sessão guiada vai mostrar. Vem do
              // motor (`descansoSeg`); a faixa da prescrição é só fallback da chamada v1.
              const desc = comp ? prescricao.descansoCompostoSeg : prescricao.descansoIsoladoSeg;
              const restSeg = sl.descansoSeg ?? descansoDoExercicio({
                exercicio: sl.exercicio,
                rirAlvo: prescricao.rirAlvoSemana ?? prescricao.rir.min,
                modoForca: prescricao.modoForca === true,
              }) ?? desc.min;
              const k = `${d}-${s}`;
              // Overlay B3: degrau assumido → o cartão exibe o exercício EFETIVO (a rotina
              // e as chaves de feedback/troca continuam no id original do slot).
              const efetivo = exercicioEfetivo(sl.exercicio.id, progresso, (id) => EXERCISES_SEED.find((e) => e.id === id)) ?? sl.exercicio;
              return (
                <div key={`${k}-${sl.exercicio.id}`} style={{ ...cardSoft, padding: '20px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'rgba(234,229,219,.22)', lineHeight: 1.2, flexShrink: 0 }}>{String(s + 1).padStart(2, '0')}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                          <span style={{ ...kicker, color: 'rgba(234,229,219,.4)' }}>{PADRAO_LABEL[sl.padrao] ?? sl.padrao}</span>
                          {/* Badge "Favorito" (B5): todo favorito que entrou no plano. */}
                          {sl.incluidoPorPreferencia && <BadgeFavorito />}
                          {/* Nome clicável (padrão da lista da Dieta) → abre o detalhe. */}
                          <button onClick={() => onDetalhe(d, s)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '1.15rem', fontWeight: 700, color: '#EAE5DB', textAlign: 'left', borderBottom: '1px dashed rgba(234,229,219,.28)' }}>{efetivo.nomePt}</button>
                          {trocados.has(`e${k}`) && <span style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#BDFF00', background: 'rgba(189,255,0,.12)', borderRadius: 6, padding: '3px 8px' }}>trocado</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          {/* Estrela (lugar principal — canto superior direito do cartão). Favorita o
                              exercício DO SLOT (id original), não o degrau adotado. */}
                          <EstrelaFavorito favoritado={favoritos.has(sl.exercicio.id)} onToggle={() => onToggleFavorito(sl.exercicio.id)} />
                          <button onClick={() => onTrocar(d, s)} className="evk-troca" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid rgba(234,229,219,.18)', color: 'rgba(234,229,219,.8)', fontWeight: 600, fontSize: '.85rem', padding: '8px 14px', borderRadius: 10, cursor: 'pointer' }}><svg width={13} height={13} viewBox="0 0 24 24" fill="none"><path d="M4 7h12l-3-3M20 17H8l3 3" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>Trocar</button>
                        </div>
                      </div>
                      {/* Indicador "Degrau X de Y" (V8.3 Estado 1) — só peso corporal com escada mapeada. */}
                      <EscadaPill exercicioId={efetivo.id} exercicioPorId={(id) => EXERCISES_SEED.find((e) => e.id === id)} margemBaixo={12} />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                        <span style={pill}>{prescricao.seriesPorExercicio.min}–{prescricao.seriesPorExercicio.max} × {reps.min}–{reps.max} reps</span>
                        <span style={pill}>RIR {prescricao.rir.min}–{prescricao.rir.max}</span>
                        <span style={pill}>Descanso {rotuloDescanso(restSeg)}</span>
                      </div>
                      <button onClick={() => onDetalhe(d, s)} className="evk-troca" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 14, background: 'none', border: '1px solid rgba(234,229,219,.18)', cursor: 'pointer', fontSize: '.86rem', fontWeight: 600, color: 'rgba(234,229,219,.8)', padding: '8px 13px', borderRadius: 10 }}><svg width={14} height={14} viewBox="0 0 24 24" fill="none"><circle cx={12} cy={12} r={9} stroke="currentColor" strokeWidth={1.8} /><path d="M12 11v5M12 8.2v.01" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></svg>Como fazer</button>
                      <div style={{ borderTop: '1px solid rgba(234,229,219,.08)', paddingTop: 13 }}>
                        <div style={{ fontSize: '.8rem', color: 'rgba(234,229,219,.55)', marginBottom: 8 }}>Como foi?</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {(['facil', 'na_medida', 'dificil'] as Feedback[]).map((f) => {
                            const on = feedback[k] === f;
                            return <button key={f} onClick={() => onFb(k, f)} style={{ cursor: 'pointer', flex: 1, padding: '9px 6px', borderRadius: 9, fontWeight: 600, fontSize: '.82rem', transition: 'all .25s ease', border: `1px solid ${on ? '#BDFF00' : 'rgba(234,229,219,.14)'}`, background: on ? 'rgba(189,255,0,.12)' : 'transparent', color: on ? '#BDFF00' : 'rgba(234,229,219,.62)' }}>{f === 'facil' ? 'Fácil' : f === 'na_medida' ? 'Na medida' : 'Difícil'}</button>;
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <p style={{ margin: '4px 2px 0', fontSize: '.88rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.55 }}>Seu retorno ajusta o próximo treino. Iniciante não treina até a falha — a carga sobe por dupla progressão guiada pelo seu feedback.</p>
      {/* Cardio (Bloco 1): o motor já prescrevia cardio na tabela 1.1 — o app é que não
          deixava registrar. A seção mora aqui, na aba Treino, como o design desenhou. */}
      <CardioSemana {...cardio} />
      {/* Entrada do "Fiquei doente" no PÉ da aba, abaixo da nota do RIR: é o único controle
          de NÍVEL DE ABA, e reusa o vocabulário do "Trocar" (que segue por exercício, dentro
          do cartão — nada foi duplicado nem movido). Continua aqui nos cinco estados. */}
      <FiqueiDoente onReconhecer={onReconhecerPausa} />
    </div>
  );
}

/* ════════════════════ Dieta ════════════════════ */

function DietaTab({ dieta, itens, totais, trocados, logs, notes, dataHoje, onStatus, onNote, onTrocar, onPorcao, onCompras, onDetalhe, descanso, onTrazerDeVolta }: {
  dieta: ResultadoMotor; itens: CardapioItem[]; totais: RecipeMacros | null; trocados: Set<string>;
  logs: Record<string, StatusRefeicao>; notes: Record<string, string>; dataHoje: string;
  onStatus: (id: string, s: StatusRefeicao) => void; onNote: (id: string, txt: string) => void;
  onTrocar: (idx: number) => void; onPorcao: (idx: number) => void; onCompras: () => void; onDetalhe: (idx: number) => void;
  descanso: { id: string; nome: string; ate: string }[]; onTrazerDeVolta: (id: string) => void;
}) {
  const plano = dieta.plano!;
  return (
    <div style={sec}>
      {/* 🔒 LEVA 2.5 — "o dia da dieta" (cofre, DF 2026-07-26). A aba deixou de ser uma
          lista de pratos e virou a LINHA DO DIA com a próxima refeição em destaque; a
          interação (abrir, ver itens, trocar, marcar que comeu) mora na refeição guiada. */}
      <DiaDaDieta
        itens={itens}
        totais={totais}
        plano={plano}
        foodsById={FOODS_BY_ID_SEED}
        logs={logs}
        notes={notes}
        trocados={trocados}
        dataHoje={dataHoje}
        onStatus={onStatus}
        onNote={onNote}
        onTrocar={onTrocar}
        onPorcao={onPorcao}
        onDetalhe={onDetalhe}
        onCompras={onCompras}
        notaCardapio={dieta.cardapio?.nota}
      />
      {descanso.length > 0 && (
        <div style={{ ...cardSoft, marginTop: 22, borderStyle: 'dashed', borderColor: 'rgba(234,229,219,.16)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M4 8h11a4 4 0 010 8h-1M4 8v9a1 1 0 001 1h8M7 4v1.5M10 4v1.5M13 4v1.5" stroke="rgba(234,229,219,.6)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span style={{ fontWeight: 700, fontSize: '.98rem' }}>Pratos em descanso</span>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: '.84rem', color: 'rgba(234,229,219,.55)', lineHeight: 1.5 }}>Você marcou &quot;Cansei deste prato&quot; nestes. Eles saem da rotação e <strong style={{ color: 'rgba(234,229,219,.75)', fontWeight: 600 }}>voltam sozinhos</strong> — ou traga de volta agora.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {descanso.map((d) => {
              const restam = Math.max(0, Math.ceil((Date.parse(d.ate) - Date.now()) / 86_400_000));
              return (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'rgba(234,229,219,.03)', borderRadius: 11, padding: '10px 13px' }}>
                  <span style={{ minWidth: 0 }}><span style={{ fontSize: '.92rem', color: 'rgba(234,229,219,.85)' }}>{d.nome}</span><span style={{ display: 'block', fontSize: '.76rem', color: 'rgba(234,229,219,.45)' }}>volta em {restam} {restam === 1 ? 'dia' : 'dias'}</span></span>
                  <button onClick={() => onTrazerDeVolta(d.id)} className="evk-troca" style={{ flexShrink: 0, background: 'none', border: '1px solid rgba(234,229,219,.2)', color: 'rgba(234,229,219,.8)', fontWeight: 600, fontSize: '.84rem', padding: '8px 14px', borderRadius: 10, cursor: 'pointer' }}>Trazer de volta</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <p style={{ margin: '18px 2px 0', fontSize: '.88rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.55 }}>O registro acompanha sua constância, não calorias. Os valores do cardápio são estimativas de uma base reconhecida de alimentos.</p>
      <p style={{ margin: '8px 2px 0', fontSize: '.88rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.55 }}>Trocas respeitam suas alergias e seu padrão alimentar — sempre.</p>
    </div>
  );
}

/* ════════════════════ Progresso ════════════════════ */

function Progresso({ pesos, treinos, onRegistrar, children, modoDiario, notaPesoPlano }: { pesos: number[]; treinos: number; onRegistrar: (v: number) => void; children?: ReactNode; modoDiario?: boolean; notaPesoPlano?: string | null }) {
  const atual = pesos[pesos.length - 1]!;
  const variacao = atual - pesos[0]!;
  return (
    <div style={sec}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 20 }}>
        <Stat rotulo="Peso atual" valor={atual.toFixed(1)} un="kg" />
        <Stat rotulo="Variação" valor={`${variacao >= 0 ? '+' : ''}${variacao.toFixed(1)}`} un="kg" cor="#BDFF00" />
        <Stat rotulo="Treinos avaliados" valor={String(treinos)} />
      </div>
      {/* O cartão de marco 7/30 saiu (substituído pelo contador da Hoje — handoff §Substituição);
          o total acumulado já aparece no stat acima, sem reintroduzir níveis. */}
      <div style={{ ...cardSoft, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}><span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Peso ao longo do tempo</span><span style={{ fontSize: '.82rem', color: 'rgba(234,229,219,.45)' }}>{pesos.length} registro{pesos.length > 1 ? 's' : ''}</span></div>
        <Grafico pesos={pesos} />
        {pesos.length < 2 && <p style={{ margin: '10px 0 0', fontSize: '.82rem', color: 'rgba(234,229,219,.5)' }}>Registre mais pesos para ver a linha evoluir.</p>}
      </div>
      <RegistrarPesoRow onRegistrar={onRegistrar} />
      {/* 🔒 Leva D — o AVISO DO RECÁLCULO. Não é subtítulo nem promessa: é o relato de um
          fato já ocorrido, no passado, sobre o APP (nunca sobre a pessoa e nunca no futuro).
          Só aparece quando o peso do plano realmente deixou de ser o do perfil — a string
          chega pronta de cima justamente para que "apareceu" e "aconteceu" sejam a mesma
          condição, sem um segundo lugar podendo discordar. */}
      {notaPesoPlano && <p style={{ margin: '10px 2px 0', fontSize: '.82rem', color: 'rgba(234,229,219,.55)', lineHeight: 1.55 }}>{notaPesoPlano}</p>}
      {children}
      {/* 🔒 CLASSE 2 — o cartão descreve o MOTOR ADAPTATIVO (plano que se recalcula), que o
          modo diário não tem. Não renderiza, e não ganha paráfrase: não existe equivalente
          verdadeiro. Silêncio, não versão adaptada. */}
      {!modoDiario && (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, background: 'linear-gradient(165deg, rgba(22,163,74,.1), rgba(15,15,14,.4))', border: '1px solid rgba(189,255,0,.2)', borderRadius: 18, padding: '22px 24px', marginTop: 18 }}>
        <span style={{ width: 42, height: 42, minWidth: 42, borderRadius: 12, background: 'rgba(189,255,0,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={22} height={22} viewBox="0 0 24 24" fill="none"><path d="M3 17 Q8 14 12 9 T21 4" stroke="#BDFF00" strokeWidth={2} fill="none" strokeLinecap="round" /><circle cx={12} cy={9} r={2.2} fill="#BDFF00" /><circle cx={21} cy={4} r={2.6} fill="#BDFF00" /></svg></span>
        <div><h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 700 }}>Como seu plano evolui</h3><p style={{ margin: 0, color: 'rgba(234,229,219,.66)', lineHeight: 1.6, fontSize: '.95rem' }}>A cada avanço seu, o treino e a dieta se <strong style={{ color: '#BDFF00', fontWeight: 600 }}>recalculam</strong> pelas regras adaptativas. Sem promessa de prazo — só o ajuste fino que a sua constância merece.</p></div>
      </div>
      )}
    </div>
  );
}

/* ════════════════════ Histórico ════════════════════ */

function Historico({ sessoes, pesos, refeicoes, logs, notes, onAbrir, onComecarTreino, onVerDieta, onRegistrarTreino, modoDiario }: {
  sessoes: SessaoLog[]; pesos: number[]; refeicoes: string[]; logs: Record<string, StatusRefeicao>; notes: Record<string, string>;
  onAbrir: (s: SessaoLog) => void; onComecarTreino: () => void; onVerDieta: () => void; onRegistrarTreino: () => void;
  /** Modo diário: o histórico é leitura do registro (liberada), mas sem enquadrar nada
   *  como "% do plano" — não existe plano contra o qual comparar. */
  modoDiario?: boolean;
}) {
  type Sub = 'treinos' | 'dieta' | 'cargas' | 'peso';
  const [sub, setSub] = useState<Sub>('treinos');
  const subTab = (id: Sub, label: string) => {
    const on = sub === id;
    return <div key={id} onClick={() => setSub(id)} style={{ cursor: 'pointer', whiteSpace: 'nowrap', padding: '9px 16px', borderRadius: 11, fontWeight: 600, fontSize: '.9rem', transition: 'all .25s ease', border: `1px solid ${on ? '#BDFF00' : 'rgba(234,229,219,.14)'}`, background: on ? 'rgba(189,255,0,.1)' : 'rgba(234,229,219,.03)', color: on ? '#BDFF00' : 'rgba(234,229,219,.62)' }}>{label}</div>;
  };
  return (
    <div style={sec}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 22, overflowX: 'auto', paddingBottom: 2 }}>{subTab('treinos', 'Treinos')}{subTab('dieta', 'Dieta')}{subTab('cargas', 'Cargas')}{subTab('peso', 'Peso')}</div>

      {sub === 'dieta' && <HistoricoDieta refeicoes={refeicoes} hojeLogs={logs} hojeNotes={notes} onVerDieta={onVerDieta} modoDiario={modoDiario} />}

      {/* Salvaguarda B2: calibrações ficam FORA do gráfico de Cargas (sessoesTreino). */}
      {sub === 'cargas' && <CargasHistorico historico={sessoesTreino(sessoes)} />}

      {sub === 'treinos' && (<>
        {/* Entrada A3 do registro manual (handoff): topo da lista de sessões. */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button onClick={onRegistrarTreino} className="evk-registrar" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: '1px solid rgba(189,255,0,.4)', color: '#BDFF00', fontWeight: 600, fontSize: '.9rem', padding: '10px 18px', borderRadius: 11, cursor: 'pointer' }}><svg width={14} height={14} viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" /></svg>Adicionar treino</button>
        </div>
        {sessoes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sessoes.map((w) => {
              // 🔒 CARDIO tem card PRÓPRIO (DF 2026-07-29). Antes caía no card genérico de
              // musculação e saía "Cardio · Sessão 2 · 0 séries · 0 kg": "Sessão N" é
              // vocabulário de SLOT DO PLANO, e séries/kg zerados fazem um registro válido
              // parecer quebrado. Mostra o que a sessão de cardio realmente tem.
              if (w.tipo === 'cardio' && w.cardio) {
                const c = w.cardio;
                return (
                  <div key={w.n} style={{ ...cardSoft, padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 30, height: 30, minWidth: 30, borderRadius: '50%', background: 'rgba(189,255,0,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M3 12h4l2.5-5 4 10 2.5-5h5" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{ROTULO_MODALIDADE[c.modalidade as ModalidadeCardio] ?? 'Cardio'}</div>
                        <div style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.6)', marginTop: 2 }}>{fmtDataCurta(w.dataISO)} · {c.minutos} min · {ROTULO_INTENSIDADE[c.intensidade as IntensidadeCardio] ?? c.intensidade}</div>
                      </div>
                    </div>
                  </div>
                );
              }
              // Registro rápido legado (V6.3, sem exercícios) — linha informativa, não clicável.
              if (w.manual && w.exercicios.length === 0) {
                return (
                  <div key={w.n} style={{ ...cardSoft, padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 30, height: 30, minWidth: 30, borderRadius: '50%', background: 'rgba(189,255,0,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={15} height={15} viewBox="0 0 24 24" fill="none"><path d="M20 6 9 17l-5-5" stroke="#BDFF00" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                      <div><div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Treino registrado</div><div style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.6)', marginTop: 2 }}>{fmtDataCurta(w.dataISO)} · Você marcou este dia como treinado.</div></div>
                    </div>
                  </div>
                );
              }
              const fbVals = Object.values(w.feedback);
              const resumoFb = fbVals.length ? `${fbVals.filter((f) => f === 'na_medida').length} na medida` : 'sem feedback';
              return (
                <div key={w.n} onClick={() => onAbrir(w)} className="hov-lift" style={{ ...cardSoft, padding: '18px 20px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                    {/* Sessão manual = MESMA aparência da guiada + texto discreto (não é badge/selo). */}
                    <div><div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{w.dia}</span>{w.manual ? <span style={{ fontSize: '.72rem', color: 'rgba(234,229,219,.4)' }}>· registrado manualmente</span> : <span style={{ fontSize: '.78rem', color: 'rgba(234,229,219,.5)' }}>Sessão {w.n}</span>}</div><div style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.6)', marginTop: 3 }}>{w.manual ? `${fmtDataCurta(w.dataISO)} · ` : ''}{w.series} série{w.series === 1 ? '' : 's'} · {w.volumeKg.toLocaleString('pt-BR')} kg · {resumoFb}</div></div>
                    <span style={{ color: 'rgba(234,229,219,.4)', fontSize: '1.2rem', flexShrink: 0 }}>→</span>
                  </div>
                </div>
              );
            })}
            <p style={{ margin: '6px 2px 0', fontSize: '.85rem', color: 'rgba(234,229,219,.5)' }}>Cada sessão concluída entra aqui com as séries, volume e seu feedback.</p>
          </div>
        ) : (
          <EmptyCard
            variante="neon"
            icone={<svg width={34} height={34} viewBox="0 0 24 24" fill="none"><path d="M4 12a8 8 0 1 1 2.5 5.8" stroke="#EAE5DB" strokeWidth={1.7} strokeLinecap="round" fill="none" /><path d="M4 18v-4.2h4.2" stroke="#EAE5DB" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M12 8.2v4l2.8 1.7" stroke="#BDFF00" strokeWidth={1.7} strokeLinecap="round" fill="none" /></svg>}
            titulo="Nenhum treino registrado ainda."
            apoio="Quando você concluir um treino, ele aparece aqui."
          >
            <button onClick={onComecarTreino} className="hov-btn" style={estiloBotaoPrimario}>{modoDiario ? 'Registrar treino feito' : 'Começar treino de hoje'}</button>
          </EmptyCard>
        )}
      </>)}

      {sub === 'peso' && (
        <div style={{ ...cardSoft, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}><span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Peso ao longo do tempo</span><span style={{ fontSize: '.82rem', color: 'rgba(234,229,219,.45)' }}>{pesos.length} registro{pesos.length > 1 ? 's' : ''}</span></div>
          <Grafico pesos={pesos} />
          {pesos.length < 2 && <p style={{ margin: '10px 0 0', fontSize: '.82rem', color: 'rgba(234,229,219,.5)' }}>Seu peso inicial já está aqui — registre de novo na aba Progresso para ver a curva.</p>}
        </div>
      )}
    </div>
  );
}

/* ════════════════════ Perfil ════════════════════ */

function Perfil({ perfil, onConta, onEditar, modoDiario }: {
  perfil: PerfilResumo; onConta: () => void; onEditar: () => void; modoDiario?: boolean;
}) {
  const linha = (k: string, v: string, last = false) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '11px 0', ...(last ? {} : { borderBottom: '1px solid rgba(234,229,219,.07)' }) }}><span style={{ color: 'rgba(234,229,219,.55)', fontSize: '.94rem' }}>{k}</span><span style={{ fontWeight: 600, fontSize: '.94rem', textAlign: 'right' }}>{v}</span></div>;
  return (
    <div style={{ ...sec, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ ...cardSoft, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Seus dados</h3>
            <button onClick={onEditar} className="evk-troca" style={{ background: 'none', border: '1px solid rgba(234,229,219,.18)', color: 'rgba(234,229,219,.8)', fontWeight: 600, fontSize: '.82rem', padding: '7px 14px', borderRadius: 10, cursor: 'pointer' }}>Editar</button>
          </div>
          {linha('Sexo biológico', perfil.sexo === 'feminino' ? 'Feminino' : 'Masculino')}
          {linha('Idade', `${perfil.idade} anos`)}
          {linha('Altura', `${perfil.alturaCm} cm`)}
          {linha('Peso', `${perfil.pesoKg} kg`, true)}
        </div>
        <div style={{ ...cardSoft, padding: 24 }}>
          {/* 🔒 CLASSE 2 — o título tinha a palavra "Plano" para quem não tem plano. */}
          <h3 style={{ margin: '0 0 18px', fontSize: '1.15rem', fontWeight: 700 }}>{modoDiario ? 'Suas preferências' : 'Plano e preferências'}</h3>
          {linha('Objetivo', OBJETIVO_LABEL[perfil.objetivo])}
          {linha('Atividade', ATIV_LABEL[perfil.nivelAtividade])}
          {linha('Experiência', perfil.nivelExperiencia.charAt(0).toUpperCase() + perfil.nivelExperiencia.slice(1))}
          {/* Chip do modo força (v2 §4) — só interm./avançado com o preset ativo.
              🔒 CLASSE 2 — "compostos a 6 reps" é PARÂMETRO DE PRESCRIÇÃO. Some em modo
              diário inclusive numa conta que já tenha o preset ligado de antes (o toggle
              some do Editar perfil, mas o dado persistido não some sozinho). */}
          {!modoDiario && perfil.modoForca && perfil.nivelExperiencia !== 'iniciante' && linha('Modo força', 'Ativo — compostos a 6 reps')}
          {linha('Padrão alimentar', perfil.preferencia ? (perfil.preferencia === 'vegano' ? 'Vegano' : 'Vegetariano') : 'Onívoro')}
          {linha('Alergias', perfil.alergenos.length ? perfil.alergenos.join(', ') : 'nenhuma', true)}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* 🔒 SEM PREÇO E SEM CONTROLE FANTASMA (DF 2026-07-29). Este cartão dizia
            "R$ 29/mês" com botões "Gerenciar assinatura" e "Cancelar" — e a decisão
            *cortesia × pago para os testadores* está ABERTA: a tela antecipava uma decisão
            que o autor não tomou. O "Cancelar" levava a /conta, onde a confirmação era só
            estado local. Fica a verdade, e um caminho para os dados/direitos. */}
        <div style={{ background: 'linear-gradient(165deg, rgba(189,255,0,.07), rgba(15,15,14,.5))', border: '1px solid rgba(189,255,0,.25)', borderRadius: 18, padding: 24 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: 700 }}>Beta gratuito</h3>
          <p style={{ margin: '0 0 18px', fontSize: '.92rem', color: 'rgba(234,229,219,.66)', lineHeight: 1.6 }}>Não existe assinatura ativa nem cobrança. Quando houver plano pago, você decide se entra.</p>
          <button onClick={onConta} style={{ width: '100%', background: 'rgba(234,229,219,.06)', border: '1px solid rgba(234,229,219,.16)', color: '#EAE5DB', fontWeight: 600, fontSize: '.92rem', padding: 12, borderRadius: 11, cursor: 'pointer' }}>Conta e meus dados</button>
        </div>
        <div style={{ ...cardSoft, padding: 8 }}>
          {([['Termos de Uso', '/termos'], ['Política de Privacidade', '/privacidade'], ['Aviso (disclaimer)', '/aviso'], ['Suporte', '/suporte']] as const).map(([t, href]) => (
            <Link key={t} href={href} className="evk-perfil-link" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 12, fontSize: '.95rem', color: 'rgba(234,229,219,.8)', textDecoration: 'none' }}>{t} <span style={{ color: 'rgba(234,229,219,.35)' }}>→</span></Link>
          ))}
        </div>
        <div style={{ padding: '4px 4px 0' }}>
          <span style={{ display: 'inline-block', marginBottom: 12, border: '1px solid rgba(234,229,219,.25)', color: 'rgba(234,229,219,.6)', borderRadius: 8, padding: '3px 10px', fontSize: '.78rem', fontWeight: 700 }}>18+</span>
          <p style={{ margin: 0, fontSize: '.8rem', color: 'rgba(234,229,219,.42)', lineHeight: 1.6 }}>O Evokorpus é uma ferramenta de uso geral e caráter educacional, dirigida pelo usuário. Não constitui prescrição, consulta ou acompanhamento nutricional ou de educação física, nem substitui a orientação de profissionais habilitados. Conteúdo para maiores de 18 anos.</p>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════ Encaminhamento (edição → ROTEAR) ════════════════════ */

// Postura fail-safe do gate de saúde (cofre, princípio 4 / gate-de-saude-evokorpus):
// a edição entrou em zona clínica → não geramos plano; orientamos profissional. Mantém o
// plano válido anterior (onManter) ou deixa revisar os dados (onRevisar). Sem promessa.
function EncaminhamentoEdicao({ motivos, onRevisar, onManter }: { motivos: string[]; onRevisar: () => void; onManter: () => void }) {
  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', animation: `evkScreenIn .5s ${EASE}` }}>
      <div style={{ width: '100%', maxWidth: 520, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(22,163,74,.16)', border: '1px solid rgba(22,163,74,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 26px' }}>
          <svg width={32} height={32} viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-4.4-7-9.6A4.4 4.4 0 0112 8a4.4 4.4 0 017 3.4c0 5.2-7 9.6-7 9.6z" stroke="#16A34A" strokeWidth={1.8} strokeLinejoin="round" /><path d="M9 11.5h1.6l.9-1.6 1 3 .9-1.4H16" stroke="#16A34A" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h1 style={{ margin: '0 0 16px', fontSize: '1.7rem', fontWeight: 700, letterSpacing: '-.02em' }}>Vamos com cuidado aqui</h1>
        <p style={{ margin: '0 0 14px', color: 'rgba(234,229,219,.7)', lineHeight: 1.65, fontSize: '1rem' }}>Com esses novos dados, seu caso pede o <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>acompanhamento de um profissional de saúde</strong>. Por segurança, não vamos recalcular um plano automático agora.</p>
        {motivos.length > 0 && <p style={{ margin: '0 0 14px', color: 'rgba(234,229,219,.55)', fontSize: '.9rem' }}>{motivos.join(' · ')}</p>}
        <p style={{ margin: '0 0 30px', color: 'rgba(234,229,219,.6)', lineHeight: 1.6, fontSize: '.95rem' }}>Seu plano atual continua disponível, sem alterações. Se quiser, revise os dados ou siga com o plano de antes.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={onRevisar} className="hov-btn" style={{ background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1rem', padding: '14px 26px', border: 'none', borderRadius: 13, cursor: 'pointer' }}>Revisar meus dados</button>
          <button onClick={onManter} className="evk-voltar" style={{ background: 'none', border: '1px solid rgba(234,229,219,.22)', color: 'rgba(234,229,219,.82)', fontWeight: 600, fontSize: '.98rem', padding: '13px 24px', borderRadius: 12, cursor: 'pointer' }}>Manter meu plano atual</button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════ Modal (fiel) ════════════════════ */

function ModalTroca({ modal, onFechar, onAplicarPrato, onMaisPrato, onAplicarPorcao, onAplicarEx, onMaisEx }: {
  modal: NonNullable<Modal>; onFechar: () => void;
  onAplicarPrato: (idx: number, o: OpcaoPrato) => void; onMaisPrato: () => void;
  onAplicarPorcao: (idx: number, f: number) => void;
  onAplicarEx: (d: number, s: number, ex: Exercise) => void; onMaisEx: () => void;
}) {
  let titulo = 'Trocar'; let sub = ''; let showMore = false; let onMore = () => {};
  const opcoes: { chave: string; nome: string; detalhe?: string; onClick: () => void }[] = [];
  if (modal.tipo === 'prato') {
    // Só oferece "gerar mais" quando veio um lote cheio (3) — se veio menos, o pool elegível
    // já se esgotou (poucos pratos cabem na janela do dia para este slot/dieta).
    const n = modal.opcoes.length; showMore = n >= 3; onMore = onMaisPrato;
    const equil = 'que mantêm o equilíbrio do dia (equivalência calórica)';
    sub = n >= 3 ? `Três opções ${equil}. Não gostou? Gere mais.`
      : n === 2 ? `Duas opções ${equil}.`
      : n === 1 ? `Uma opção que mantém o equilíbrio do dia (equivalência calórica).`
      : '';
    modal.opcoes.forEach((o) => opcoes.push({ chave: o.prato.id, nome: o.prato.nome, detalhe: `${r0(o.macros.kcal)} kcal · ${r0(o.macros.proteinaG)} g prot`, onClick: () => onAplicarPrato(modal.idx, o) }));
  } else if (modal.tipo === 'exercicio') {
    const n = modal.opcoes.length; showMore = n >= 3; onMore = onMaisEx;
    sub = n >= 3 ? 'Mantém o grupo e o padrão, respeitando seu equipamento. Não gostou? Gere mais.'
      : n >= 1 ? 'Mantém o grupo e o padrão, respeitando seu equipamento.'
      : '';
    modal.opcoes.forEach((ex) => opcoes.push({ chave: ex.id, nome: ex.nomePt, detalhe: `${ex.grupoMuscular}${ex.equipamentoDetalhe ? ` · ${ex.equipamentoDetalhe}` : ''}`, onClick: () => onAplicarEx(modal.d, modal.s, ex) }));
  } else {
    titulo = 'Editar porção'; sub = 'Ajuste a quantidade do prato — a estimativa de referência acompanha.';
    PORCOES.forEach((p) => opcoes.push({ chave: String(p.f), nome: `${p.r}${p.f === 1 ? ' (padrão)' : ''}`, onClick: () => onAplicarPorcao(modal.idx, p.f) }));
  }
  return (
    <div onClick={onFechar} style={{ position: 'fixed', inset: 0, zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(7,18,11,.66)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 430, background: 'linear-gradient(168deg, rgba(16,42,26,.98), rgba(15,15,14,.98))', border: '1px solid rgba(234,229,219,.14)', borderRadius: 22, padding: 24, boxShadow: '0 40px 90px -30px rgba(0,0,0,.8)', animation: `evkPop .3s ${EASE}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <div style={{ fontSize: '.72rem', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: '#BDFF00' }}>{titulo}</div>
          <button onClick={onFechar} aria-label="Fechar" style={{ background: 'none', border: 'none', color: 'rgba(234,229,219,.5)', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', padding: 0, marginTop: -2 }}>×</button>
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-.01em', marginBottom: 6 }}>{modal.base}</div>
        <p style={{ margin: '0 0 18px', fontSize: '.86rem', color: 'rgba(234,229,219,.6)', lineHeight: 1.5 }}>{sub}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: showMore ? 14 : 0 }}>
          {/* Vazio honesto (DF 2026-07-04): com o filtro duro de preservação, um movimento único
              no seu equipamento não tem troca equivalente — sinalizamos em vez de inventar. */}
          {opcoes.length === 0 && <p style={{ fontSize: '.9rem', color: 'rgba(234,229,219,.6)', lineHeight: 1.5 }}>Não achei uma troca equivalente para este exercício com o seu equipamento — melhor manter do que trocar por algo que trabalha outra coisa.</p>}
          {opcoes.map((o) => (
            <button key={o.chave} onClick={o.onClick} className="modal-opt" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', textAlign: 'left', background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.12)', borderRadius: 14, padding: '15px 17px', color: '#EAE5DB', cursor: 'pointer' }}>
              <span><span style={{ display: 'block', fontSize: '1rem', fontWeight: 600 }}>{o.nome}</span>{o.detalhe && <span style={{ display: 'block', fontSize: '.78rem', color: 'rgba(234,229,219,.55)', marginTop: 2 }}>{o.detalhe}</span>}</span>
              <span style={{ width: 26, height: 26, minWidth: 26, borderRadius: '50%', border: '1px solid rgba(234,229,219,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#BDFF00' }}><svg width={14} height={14} viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg></span>
            </button>
          ))}
        </div>
        {showMore && (
          <button onClick={onMore} className="modal-more" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: 'rgba(189,255,0,.1)', border: '1px solid rgba(189,255,0,.3)', color: '#BDFF00', fontWeight: 700, fontSize: '.94rem', padding: 13, borderRadius: 13, cursor: 'pointer' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M4 5v5h5M20 19v-5h-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><path d="M19 9a7.5 7.5 0 00-13-2.5L4 10M5 15a7.5 7.5 0 0013 2.5L20 14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
            Não gostei de nenhuma — gerar mais variedade
          </button>
        )}
      </div>
    </div>
  );
}

/* ════════════════════ Primitivos ════════════════════ */

const menuBtn = (muted: boolean): CSSProperties => ({ width: '100%', textAlign: 'left', background: 'none', border: 'none', color: muted ? 'rgba(234,229,219,.75)' : '#EAE5DB', fontSize: '.94rem', fontWeight: 500, padding: '11px 13px', borderRadius: 9, cursor: 'pointer' });

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
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-label="Evokorpus">
      <line x1={28} y1={16} x2={28} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" /><line x1={29} y1={50} x2={68} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" />
      <path d="M33 50 Q50 38 70 18" stroke="#BDFF00" strokeWidth={3.5} fill="none" strokeLinecap="round" /><circle cx={35} cy={50} r={4.5} fill="#BDFF00" /><circle cx={52} cy={35} r={5} fill="#BDFF00" /><circle cx={70} cy={18} r={6} fill="#BDFF00" />
    </svg>
  );
}
const Marca = ({ size }: { size: string }) => <span style={{ fontWeight: 800, fontSize: size, letterSpacing: '-.02em' }}><span style={{ color: '#EAE5DB' }}>evo</span><span style={{ color: '#BDFF00' }}>korpus</span></span>;

function Barra({ nome, g, pct, cor }: { nome: string; g: number; pct: number; cor: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.84rem', marginBottom: 5 }}><span style={{ color: 'rgba(234,229,219,.7)' }}>{nome}</span><span style={{ color: 'rgba(234,229,219,.5)' }}>{g} g</span></div>
      <div style={{ height: 6, background: 'rgba(234,229,219,.1)', borderRadius: 99, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: cor, borderRadius: 99 }} /></div>
    </div>
  );
}
function Stat({ rotulo, valor, un, cor }: { rotulo: string; valor: string; un?: string; cor?: string }) {
  return <div style={{ ...cardSoft, padding: 20, borderRadius: 16 }}><div style={{ fontSize: '.78rem', color: 'rgba(234,229,219,.5)', marginBottom: 6 }}>{rotulo}</div><div style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-.02em', color: cor ?? '#EAE5DB' }}>{valor}{un && <span style={{ fontSize: '.95rem', color: 'rgba(234,229,219,.5)', fontWeight: 500 }}> {un}</span>}</div></div>;
}

/**
 * 🔒 O subtítulo é UNIFICADO DE PROPÓSITO (DF 2026-07-29, revista). **Não ramifique.**
 *
 * A frase anterior — "Um registro rápido mantém seu plano calibrado." — parece verdadeira
 * para quem tem plano, e não é: **`registrarPeso` NÃO alimenta `perfil.pesoKg`.** Ele só
 * empilha o valor em `pesos` (memória), `evk_pesos` (local) e no servidor — tudo exibição:
 * o stat "Peso atual", o gráfico e o histórico. Já a dieta lê `perfil.pesoKg`:
 *
 *     registrarPeso(v)                    → setPesos · registrarPesoLocal · registrarPesoServidor
 *     calcularTMB(sexo, perfil.pesoKg, …) → health-gate.ts:66-70
 *     perfil.pesoKg só muda em            → EditarPerfil (recalcular → recomputarPlano)
 *
 * Ou seja, registrar peso **não recalibra nada**. A cadeia peso → TMB (Mifflin-St Jeor) →
 * GET → kcal-alvo existe, mas é alimentada pelo peso DO PERFIL, não pelo registro. Prometer
 * calibração no ato do registro seria falso nos dois modos — não é um caso de modo diário.
 *
 * ⚠️ **A Leva D (DF 2026-07-31) mexeu no motor e a frase CONTINUA fora daqui.** O registro
 * agora realimenta o plano — mas por uma ÂNCORA (`lib/peso-plano`), não por `perfil.pesoKg`,
 * e só quando há ≥ 3 pesagens em 7 dias, movendo-se no máximo 1×/semana. Ou seja: no ATO do
 * registro, uma pesagem isolada continua não calibrando nada. Prometer calibração no botão
 * seria falso no instante em que a pessoa lê. O que o app faz de verdade — o recálculo já
 * ocorrido — é dito no `notaPesoPlano`, no passado, e só quando aconteceu.
 *
 * 🔴 NÃO reintroduza `modoDiario` aqui: o subtítulo segue unificado, e a diferença entre os
 * modos mora na nota, que é outra frase e outro lugar.
 */
function RegistrarPesoRow({ onRegistrar }: { onRegistrar: (v: number) => void }) {
  const [v, setV] = useState('');
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 16, padding: '18px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <span style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(189,255,0,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={20} height={20} viewBox="0 0 24 24" fill="none"><path d="M4 18 Q9 16 12 11 T20 5" stroke="#BDFF00" strokeWidth={2} fill="none" strokeLinecap="round" /><circle cx={12} cy={11} r={2} fill="#BDFF00" /><circle cx={20} cy={5} r={2.4} fill="#BDFF00" /></svg></span>
        <div><div style={{ fontWeight: 600, fontSize: '1rem' }}>Como está o peso hoje?</div><div style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.55)' }}>Um registro rápido guarda a sua variação.</div></div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="number" inputMode="decimal" placeholder="kg" value={v} onChange={(e) => setV(e.target.value)} style={{ width: 80, background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 11, padding: '10px 12px', color: '#EAE5DB', fontSize: '.95rem', outline: 'none' }} />
        <button onClick={() => { onRegistrar(Number(v)); setV(''); }} style={{ background: 'none', border: '1px solid rgba(189,255,0,.4)', color: '#BDFF00', fontWeight: 600, fontSize: '.92rem', padding: '11px 20px', borderRadius: 11, cursor: 'pointer' }}>Registrar peso</button>
      </div>
    </div>
  );
}

function Grafico({ pesos }: { pesos: number[] }) {
  return <GraficoLinha serie={pesos} gradId="evkChartPeso" />;
}
