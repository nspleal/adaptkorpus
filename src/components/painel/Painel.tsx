'use client';

import { seriesDoSlot } from '@/lib/series-treino';
import ResumoSeries from './ResumoSeries';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { listarSubstituicoesPrato, listarSubstituicoesExercicio } from '@/lib/engine';
import type { FlagsSaude } from '@/lib/engine';
import type { RotinaSemanal } from '@/lib/engine/treino-types';
import type { Orcamento } from '@/lib/engine/orcamento';
import { Orcamento as SeletorOrcamento, ROTULO_ORCAMENTO } from '@/components/perfil/DiasEPreferencias';
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
import { avaliarBanimento, avaliarTroca, PREFERENCIAS_VAZIAS, type PreferenciasTreino } from '@/lib/engine/preferencias';
import { aplicarFocoCore, type FocoGrupo } from '@/lib/engine/trilhos';
import { medirEntregaDoFoco } from '@/lib/foco-entrega';
import { fraseDoFoco } from '@/lib/foco-copy';
import { ROTULO_GRUPO } from '@/lib/frequencia-grupos';
import { identidadesDe } from '@/lib/exercicio-identidade';
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
import { DIA_LABEL, ORDEM_SEMANA, type Weekday } from '@/lib/semana';
import { normalizarEntradaPlanoVisivel, opcoesDeEntradaPlano, type EntradaPlanoVisivel } from '@/lib/plano-cas-comando';
import { sessaoDeHojeIdx, weekdayHojeIdx } from '@/lib/semana';
import SessaoTreino, { type ResumoSessao } from './SessaoTreino';
import SuaSemana from './SuaSemana';
import AvisosMotor from './AvisosMotor';
import AvisosHidratacao from './AvisosHidratacao';
import { chaveSessao } from '@/lib/treino-historico';
import OfertaCardio from './OfertaCardio';
import { registrarEvento } from '@/lib/metricas/registrar';
import GraficoLinha from './GraficoLinha';
import { ContadorTreinos } from './ChamaContador';
import RegistrarTreino from './RegistrarTreino';
import CargasHistorico from './CargasHistorico';
import ListaCompras from './ListaCompras';
import EditarPerfil from './EditarPerfil';
import { DetalheExercicio, DetalhePrato, DetalheSessao } from './DetalheModais';
import SeletorExercicio from './SeletorExercicio';
import EditorTreino, { PainelCritico, recomendacoesVisiveis, doPlano, paraRotinaCustom, type DiaEditavel } from './EditorTreino';
import { avaliarRotinaAutomaticaFinal, avaliarSemana, type Avaliacao } from '@/lib/engine/critico';
import { unificarAvisos } from '@/lib/avisos-unificados';
import { useRegistro, HistoricoDieta, type StatusRefeicao } from './RegistroRefeicao';
import { EmptyCard, estiloBotaoPrimario } from '@/components/estados/ui';
import { EXERCISES_SEED, FOODS_BY_ID_SEED, RECIPES_SEED } from '@/lib/data/seed';
import type {
  CardapioItem, DiaNaoAtendido, DiaTreino, DivisaoPreferida, NivelAtividade, NivelExperiencia, Objetivo, ResultadoMotor, ResultadoTreino, RotinaCustom, Sexo,
} from '@/lib/engine';
import type { Alergeno, EquipamentoCasa, EquipamentoDisp, Exercise, RecipeMacros } from '@/lib/data/types';
import { chaveLocal } from '@/lib/escopo-local';
import { useAbaVoltavel, useCamadaVoltavel, useVoltarDoNavegador } from '@/lib/usar-voltar';

/**
 * Painel (área logada) — porte FIEL do Evokorpus App.dc.html (estilos inline exatos +
 * evkPop/evkScreenIn). Ligado ao motor determinístico real (gate/dieta/treino/F.2).
 */

export interface PerfilResumo {
  /** Avisos de recuperação do perfil; não são parâmetros do motor nem dados de saúde. */
  avisosHidratacao?: string[];
  /**
   * 🔴 D11 — campos ESSENCIAIS que a hidratação não conseguiu ler. Presente e não-vazio ⇒ a
   * geração fica SUSPENSA (`lib/plano`) e a tela oferece a correção. Não é dado de saúde: são
   * nomes de campo. O valor ilegível continua no perfil — nada é apagado.
   */
  camposInvalidos?: string[];
  sexo: Sexo; idade: number; alturaCm: number; pesoKg: number; objetivo: Objetivo;
  nivelAtividade: NivelAtividade; nivelExperiencia: NivelExperiencia; equipamento: EquipamentoDisp;
  preferencia: 'vegano' | 'vegetariano' | null; alergenos: Alergeno[]; diasDisponiveis: number; tempoPorSessaoMin: number;
  /** Dias da semana em que treina (Seg→Dom). É a fonte de verdade da agenda; `diasDisponiveis` = length. */
  treinoDias: Weekday[];
  /** "Alimentos que não curto" — IDs da paleta curada (preferência relaxável no motor). */
  naoCurto: string[];
  /**
   * 💰 Leva H — orçamento da dieta (pedido nº 11 do beta). TETO, NUNCA ALVO. Ausente = `alto`
   * = sem restrição: ninguém ganha limite que não pediu (cofre §`orcamento`, DF 2026-07-26).
   */
  orcamento?: Orcamento | null;
  /** Exercícios FAVORITOS (⭐ V8.2, DF #12): o montador os prefere sempre que couberem
   *  (isentos da variedade; filtros duros intactos). Espelho positivo do "não gosto". */
  favoritos?: string[];
  /** Checklist de equipamento de CASA (modelo 2 níveis, DF 2026-07-04). Vazio = "nenhum
   *  equipamento". Só relevante quando equipamento === 'casa'. */
  equipamentosCasa?: EquipamentoCasa[];
  /**
   * 🎛️ v3 · Bloco A — as preferências de treino ("prefiro X" · "não quero mais Y").
   * Vivem AQUI, no perfil, e não na rotina: a rotina é recomputada e não é persistida, então
   * preferência guardada nela morre no primeiro reload. Mesmo trilho dos favoritos.
   */
  preferencias?: PreferenciasTreino;
  /** 🎛️ v3 · Bloco B — o grupo em foco (1 por vez, janela de 4–6 semanas). */
  foco?: FocoGrupo;
  /** 🎛️ v4 · DF③ (2026-08-12) — divisão preferida (`auto` | `superior-inferior` |
   *  `prioridades`). Ausente = `auto`. Persistida na leva A; consumida pelo alocador (leva B). */
  divisaoPreferida?: DivisaoPreferida;
  /**
   * 🧭 EDITOR GUIADO (2026-08-13) — o desenho do usuário (só ids por dia, ~380 bytes).
   * Ausente = o gerador monta. "Voltar ao recomendado" apaga este campo, e só ele.
   */
  rotinaCustom?: RotinaCustom;
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
  /** 🏃 C2 — modalidade preferida de cardio (default `caminhada` quando ausente). */
  cardioFavorito?: ModalidadeCardio;
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

export default function Painel({ perfil: perfilProp, dieta: dietaProp, treino: treinoProp, onSair, onPerfilChange, entradaPlanoInicial, desfechoC, modoDiario = false }: {
  perfil: PerfilResumo; dieta: ResultadoMotor; treino: ResultadoTreino; onSair: () => void;
  /** Perfil + entradas que alteraram o plano visível viajam juntos para o CAS. */
  onPerfilChange?: (p: PerfilResumo, entrada: EntradaPlanoVisivel) => void;
  entradaPlanoInicial?: EntradaPlanoVisivel; desfechoC?: boolean;
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
  /** Oferta pertence ao INPUT do plano salvo, nunca às preferências permanentes do perfil. */
  const [diasOferecidosCardio, setDiasOferecidosCardio] = useState<Weekday[]>(
    () => entradaPlanoInicial?.diasOferecidosCardio ?? [],
  );
  // Não há seletor de lateralidade nesta tela ainda; enquanto isso, uma escolha já recebida
  // precisa sobreviver a qualquer recomputação em vez de sumir silenciosamente do certificado.
  const escolhasExecucaoRef = useRef(new Map(entradaPlanoInicial?.escolhasExecucao ?? []));
  /** Evita regravar em todo render a mesma fotografia de entradas dinâmicas. */
  const ultimaEntradaEnviadaRef = useRef<EntradaPlanoVisivel | undefined>(entradaPlanoInicial);
  const restricoes = { alergenos: perfil.alergenos, preferencia: perfil.preferencia };
  // Aba ativa persistida (evk_aba): reload/voltar restauram exatamente a aba anterior.
  const [aba, setAba] = useState<Aba>(() => {
    if (typeof window === 'undefined') return 'hoje';
    const a = window.localStorage.getItem(chaveLocal('evk_aba')) as Aba | null;
    return a && ABAS_VALIDAS.has(a) ? a : 'hoje';
  });
  useEffect(() => { try { window.localStorage.setItem(chaveLocal('evk_aba'), aba); } catch { /* noop */ } }, [aba]);
  /**
   * 🔴 O VOLTAR DO NAVEGADOR (pedido-ui-biblioteca-e-voltar-2026-08-13, item 2). `irAbaHist`
   * troca a aba EMPILHANDO a anterior, então o Voltar refaz o caminho visitado em vez de
   * saltar para fora de `/app`. Todo caminho de troca de aba passa por aqui — um `setAba`
   * solto seria um buraco por onde o defeito volta.
   */
  useVoltarDoNavegador();
  const irAbaHist = useAbaVoltavel<Aba>(aba, setAba);
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
  const [pesoMotorKg, setPesoMotorKg] = useState(entradaPlanoInicial?.pesoEfetivoKg ?? perfil.pesoKg);
  /** Última âncora já refletida na dieta — evita regerar o cardápio sem o peso ter mudado. */
  const pesoAplicadoRef = useRef(entradaPlanoInicial?.pesoEfetivoKg ?? perfil.pesoKg);
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
  /** 🎛️ v3 · Bloco A: a explicação da preferência RECUSADA. Recusa que não explica é recusa silenciosa. */
  const [recusa, setRecusa] = useState<string | null>(null);
  /** 🎛️ v3 · Bloco A: a resposta do motor ao "não quero mais este" (recusa ou confirmação). */
  const [banimentoTexto, setBanimentoTexto] = useState<string | null>(null);
  /** 🎛️ v3.1: a recusa EXPLICADA do foco de core (sem folga de séries). */
  const [avisoFoco, setAvisoFoco] = useState<string | null>(null);
  /**
   * 🔎 DF③ — o seletor compartilhado aberto a partir do TROCAR ("ver a biblioteca
   * completa"). Guarda o slot de destino; `null` = fechado.
   */
  const [biblioteca, setBiblioteca] = useState<{ d: number; s: number } | null>(null);
  /** 🧭 Editor guiado aberto? `null` = fechado. */
  const [editorDias, setEditorDias] = useState<DiaEditavel[] | null>(null);
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
    notificarPerfil(novo);
  }
  function limparReconhecimento() {
    const { reconhecidoEm: _fora, ...novo } = perfil;
    void _fora;
    setPerfil(novo);
    notificarPerfil(novo);
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
    notificarPerfil(novo);
    const { treino: nt } = recomputarPlano(novo, opcoesDoPlano());
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
    irAbaHist('progresso');
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
    /**
     * 💰 Leva H — o evento do ORÇAMENTO, na VIRADA do estado (não a cada render, não a cada
     * salvamento). Sem ele a adoção da feature é impossível de ler. Payload = só o valor
     * escolhido; `nenhum` distingue "não quis" de "quis sem restrição" (`alto`), que é a
     * diferença que a leitura precisa. Migration 0013 (o CHECK rejeitaria em silêncio).
     */
    if ((novo.orcamento ?? null) !== (perfil.orcamento ?? null)) {
      registrarEvento('orcamento_escolhido', { valor: novo.orcamento ?? 'nenhum' });
    }
    /**
     * 🎛️ v3 · Bloco B — a RECUSA do foco de core, decidida ANTES do recompute (é ela que
     * muda o `novo`). Os eventos `foco_ativado` saem DEPOIS, medidos do plano montado —
     * leva A2 do v4 (handoff-motor-volume-v4-2026-08-12).
     */
    const focoAntes = perfil.foco;
    let focoDepois = novo.foco;
    if (focoDepois && focoDepois.grupo !== focoAntes?.grupo && focoDepois.grupo === 'core') {
      /**
       * 🔒 FOCO DE CORE (DF 2026-08-05): mecânica de SÉRIES NOS SLOTS EXISTENTES, com teto
       * de séries por exercício do nível.
       *
       * 🔴 **Sem folga ⇒ RECUSA EXPLICADA, nunca entrega vazia.** Core tem tipicamente 1
       * slot por sessão, então cair para `'ordem'` — como fazem os outros grupos — seria
       * INERTE, e entrega inerte é sucesso simulado. Por isso o foco não é salvo: guardar
       * um foco que não faz nada é a mesma mentira, guardada.
       */
      const slots = rotinaDias.flatMap((d) => d.slots).filter((sl) => sl.exercicio.grupoPrimario === 'core');
      const efeito = aplicarFocoCore({
        nSlotsCore: slots.length,
        seriesCoreAtuais: slots.reduce((a, sl) => a + (sl.series ?? 0), 0),
        alvoCompensaBase: seriesSemanaisDoGrupo(focoDepois.compensa),
        nivel: novo.nivelExperiencia,
        objetivo: novo.objetivo,
      });
      if (!efeito.aceita) {
        registrarEvento('preferencia_recusada', { tipo: 'foco_core', motivo: efeito.motivo ?? 'core_sem_folga', de_id: 'core', para_id: focoDepois.compensa });
        setAvisoFoco(efeito.explicacao ?? null);
        focoDepois = undefined;
        novo = { ...novo, foco: undefined };
      }
    }
    if (focoAntes && !focoDepois) {
      registrarEvento('foco_encerrado', { grupo: focoAntes.grupo, semanas: focoAntes.semana, motivo: 'escolha_usuario' });
    }

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
    const { dieta: nd, treino: nt } = recomputarPlano(novo, opcoesDoPlano({ pesoEfetivoKg }));
    // Fail-safe clínico (cofre, princípio 4 — gate-de-saude-evokorpus): se a edição cair em
    // ROTEAR (ex.: IMC < 16) o motor NÃO gera plano. Não persistimos nem substituímos o plano
    // válido atual — mostramos o encaminhamento e deixamos revisar ou manter o plano de antes.
    if (nd.gate.comportamento === 'ROTEAR' || !nd.plano || !nt.rotina) {
      setEditando(false);
      setEncaminhamento(nd.gate.motivos ?? []);
      window.scrollTo(0, 0);
      return;
    }
    /**
     * 🔴 TELEMETRIA HONESTA DO FOCO — leva A2 do v4 (handoff-motor-volume-v4-2026-08-12).
     *
     * O defeito medido: `entrega`/`delta` saíam de `aplicarFoco` sobre o ALVO — e o alvo é
     * truncado pela distribuição (`n_slots × sMax`), então o evento dizia `volume` com o
     * plano idêntico. Agora os dois campos são MEDIDOS do plano montado, contra o
     * contrafactual exato (o MESMO perfil novo, sem o foco) — `medirEntregaDoFoco`. Se nada
     * mudou, o evento NÃO dispara: a ausência é o dado honesto.
     */
    if (focoDepois && focoDepois.grupo !== focoAntes?.grupo) {
      const { treino: ntSemFoco } = recomputarPlano({ ...novo, foco: undefined }, opcoesDoPlano({ pesoEfetivoKg }));
      const efeito = medirEntregaDoFoco(nt, ntSemFoco, focoDepois.grupo);
      if (efeito) {
        registrarEvento('foco_ativado', { grupo: focoDepois.grupo, compensa: focoDepois.compensa, entrega: efeito.entrega, delta: efeito.delta });
        setAvisoFoco(null);
      }
    }
    setEncaminhamento(null);
    notificarPerfil(novo, { pesoEfetivoKg });
    setPerfil(novo);
    setDieta(nd);
    setTreino(nt);
    setCardItens(nd.cardapio?.itens ?? []);
    setCardTotais(nd.cardapio?.totais ?? null);
    setRotinaDias(nt.rotina?.dias ?? []);
    setTrocados(new Set());
    setMostrarC(nd.gate.comportamento === 'RESTRINGIR' || nd.gate.comportamento === 'PISAR');
    setEditando(false);
    irAbaHist('hoje');
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
    const { dieta: nd } = recomputarPlano(novo, opcoesDoPlano());
    if (!nd.plano || !nd.cardapio) return; // robustez (saúde não muda aqui → não vira ROTEAR)
    notificarPerfil(novo);
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

  /**
   * 💰 Mini-leva de DESCOBRIBILIDADE — a porta do orçamento na própria aba Dieta.
   *
   * 🔑 DUAS PORTAS, UM ESTADO: esta e a de Editar perfil escrevem o MESMO `perfil.orcamento`
   * e leem dele. Exibições divergentes entre as duas seriam "duas verdades para o mesmo
   * número" — a classe que o cofre já nomeou.
   *
   * Usa `aplicarRotacao` (recomputa só a dieta) e NÃO `recalcular`: aquele termina com
   * `setAba('hoje')`, o que jogaria a pessoa para fora da tela onde ela acabou de escolher.
   * O evento sai aqui porque a virada de estado é aqui.
   */
  function mudarOrcamento(v: Orcamento | null) {
    if ((v ?? null) === (perfil.orcamento ?? null)) return; // sem virada, sem evento
    registrarEvento('orcamento_escolhido', { valor: v ?? 'nenhum' });
    aplicarRotacao({ ...perfil, orcamento: v });
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
  /**
   * 🎛️ v3 · Bloco A — a troca vira PREFERÊNCIA (DF 2026-07-31, cofre §"A FORMA da edição
   * manual"). Antes ela mexia só em `rotinaDias`, que é memória de render: o primeiro reload
   * (ou a virada de semana, ou a rampa, ou um favorito novo) apagava a escolha da pessoa.
   * Agora ela vai para o PERFIL, que é o que o montador lê como entrada — o mesmo trilho dos
   * favoritos, o único que já sobrevive ao recompute.
   *
   * 🔴 A preferência que fura um trilho é RECUSADA COM EXPLICAÇÃO, nunca aplicada em
   * silêncio — e a recusa é medida, porque é ela que diz se os trilhos estão no lugar.
   */
  function aplicarEx(d: number, s: number, ex: Exercise) {
    const deId = rotinaDias[d]?.slots[s]?.exercicio.id ?? '';
    const veredito = avaliarTroca(
      { exercises: EXERCISES_SEED, equipamento: perfil.equipamento, equipamentosCasa: perfil.equipamentosCasa, nivelExperiencia: perfil.nivelExperiencia },
      { de: deId, para: ex.id },
    );
    if (!veredito.aceita) {
      registrarEvento('preferencia_recusada', { tipo: 'troca', motivo: veredito.motivo ?? 'desconhecido', de_id: deId, para_id: ex.id });
      setRecusa(veredito.explicacao ?? null);
      return;
    }
    registrarEvento('exercicio_substituido', { de_id: deId, para_id: ex.id, motivo: 'escolha_usuario' });
    registrarEvento('preferencia_criada', { tipo: 'troca', de_id: deId, para_id: ex.id });
    const prefsAtuais = perfil.preferencias ?? PREFERENCIAS_VAZIAS;
    const novoPerfil = {
      ...perfil,
      preferencias: {
        ...prefsAtuais,
        // Uma preferência por exercício preterido: escolher de novo SUBSTITUI a anterior,
        // senão a lista cresceria com decisões que a pessoa já revogou.
        trocas: [...prefsAtuais.trocas.filter((t) => t.de !== deId), { de: deId, para: ex.id }],
      },
    };
    setPerfil(novoPerfil);
    notificarPerfil(novoPerfil);
    const { treino: nt } = recomputarPlano(novoPerfil, opcoesDoPlano());
    setTreino(nt);
    setRotinaDias(nt.rotina?.dias ?? []);
    /**
     * 🔒 O selo "trocado" deriva DO PLANO, não do registro da preferência (armadilha 3 do
     * handoff-motor-volume-v4): antes o `marcar` era incondicional, e o selo acendia mesmo
     * quando o montador não aplicava a troca — o selo mentia exatamente no caso em que o
     * defeito do fio escondia tudo. Agora só acende se o slot de fato mudou.
     */
    if (nt.rotina?.dias[d]?.slots[s]?.exercicio.id !== deId) marcar(`e${d}-${s}`);
    setModal(null);
  }
  /**
   * 🎛️ v3 · Bloco A — *"não quero mais Y"*: o gatilho da B5 servido por PREFERÊNCIA.
   *
   * 🔴 A trava executada aqui: banimento que esvaziaria um movimento é RECUSADO, não
   * obedecido — o vazio apareceria no meio do treino, não na hora do banimento. E tanto o
   * aceite quanto a recusa são medidos: sem o evento adverso, mede-se só o caminho feliz.
   */
  function banirExercicio(id: string) {
    const prefsAtuais = perfil.preferencias ?? PREFERENCIAS_VAZIAS;
    const veredito = avaliarBanimento(
      { exercises: EXERCISES_SEED, equipamento: perfil.equipamento, equipamentosCasa: perfil.equipamentosCasa, nivelExperiencia: perfil.nivelExperiencia, banidos: prefsAtuais.banidos },
      id,
    );
    if (!veredito.aceita) {
      registrarEvento('preferencia_recusada', { tipo: 'banimento', motivo: veredito.motivo ?? 'desconhecido', de_id: id, para_id: '' });
      setBanimentoTexto(veredito.explicacao ?? null);
      return;
    }
    registrarEvento('preferencia_criada', { tipo: 'banimento', de_id: id, para_id: '' });
    const novoPerfil = {
      ...perfil,
      preferencias: {
        // Banir também revoga a preferência que apontava PARA ele: manter as duas deixaria
        // o perfil com uma ordem que se contradiz.
        trocas: prefsAtuais.trocas.filter((t) => t.para !== id),
        banidos: [...new Set([...prefsAtuais.banidos, id])],
      },
    };
    setPerfil(novoPerfil);
    notificarPerfil(novoPerfil);
    const { treino: nt } = recomputarPlano(novoPerfil, opcoesDoPlano());
    setTreino(nt);
    setRotinaDias(nt.rotina?.dias ?? []);
    setBanimentoTexto('Combinado — ele sai do seu plano. Se mudar de ideia, dá para trazer de volta em Editar perfil.');
  }

  /**
   * 🔎 "Trazer de volta" — o inverso de `banirExercicio`, a um toque no seletor (antes só
   * existia no Editar perfil). Sem recusa possível: desfazer um banimento nunca fura trilho.
   */
  function desbanirExercicio(id: string) {
    const prefsAtuais = perfil.preferencias ?? PREFERENCIAS_VAZIAS;
    if (!prefsAtuais.banidos.includes(id)) return;
    const novoPerfil = {
      ...perfil,
      preferencias: { ...prefsAtuais, banidos: prefsAtuais.banidos.filter((x) => x !== id) },
    };
    setPerfil(novoPerfil);
    notificarPerfil(novoPerfil);
    const { treino: nt } = recomputarPlano(novoPerfil, opcoesDoPlano());
    setTreino(nt);
    setRotinaDias(nt.rotina?.dias ?? []);
  }

  /**
   * 🧭 EDITOR GUIADO — abrir, salvar e voltar ao recomendado.
   *
   * 🔒 DF② — o que se PERSISTE é só o desenho (ids por dia): séries/RIR/descanso continuam
   * do motor a cada recompute, e o plano custom progride igual ao gerado. Guardar o plano
   * inteiro congelaria a pessoa fora de todo conserto futuro do motor.
   */
  function abrirEditor() {
    const origem = perfil.rotinaCustom ? 'plano' : rotinaDias.length > 0 ? 'plano' : 'vazio';
    registrarEvento('editor_aberto', { origem });
    setEditorDias(doPlano(rotinaDias, perfil.treinoDias ?? [], perfil.rotinaCustom));
  }

  function salvarTreinoCustom(dias: DiaEditavel[], avaliacao: Avaliacao) {
    const rotinaCustom = paraRotinaCustom(dias);
    registrarEvento('treino_custom_salvo', {
      dias: rotinaCustom.dias.length,
      exercicios: rotinaCustom.dias.reduce((n, d) => n + d.exercicioIds.length, 0),
      // 🔑 O campo que dá sentido aos outros: quantos avisos estavam na tela no salvamento.
      // A DF① decidiu que aviso não trava — isto é o que torna a decisão auditável.
      avisos_ativos: avaliacao.avisos.length,
    });
    const novoPerfil = { ...perfil, rotinaCustom };
    setPerfil(novoPerfil);
    notificarPerfil(novoPerfil);
    const { treino: nt } = recomputarPlano(novoPerfil, opcoesDoPlano());
    setTreino(nt);
    setRotinaDias(nt.rotina?.dias ?? []);
    setEditorDias(null);
    window.scrollTo(0, 0);
  }

  /**
   * 🔑 A PRÉVIA do editor: roda o MOTOR sobre o desenho em construção e devolve os dias
   * com as séries/descanso que o plano salvo teria. Nada de estimativa paralela — é o
   * mesmo `recomputarPlano` do salvamento, só que sem persistir.
   */
  function preverPlano(dias: readonly DiaEditavel[]) {
    const rotinaCustom = paraRotinaCustom(dias);
    if (rotinaCustom.dias.length === 0) return [];
    const { treino: nt } = recomputarPlano({ ...perfil, rotinaCustom }, opcoesDoPlano());
    return (nt.rotina?.dias ?? []).map((d) => ({
      nome: d.nome,
      exercicios: d.slots.map((s) => s.exercicio),
      // 🔒 C1 — séries/descanso REAIS do motor, sem preencher o que falta: o critério de tempo
      // abstém-se (NAO_AVALIADO) em vez de afirmar sobre número inventado; o placar de volume
      // usa `ctx.seriesPadrao` como piso.
      series: d.slots.map((s) => s.series),
      descansoSeg: d.slots.map((s) => s.descansoSeg),
      holdSeg: d.slots.map((s) => s.holdSeg),
    }));
  }

  /** "Voltar ao recomendado" = apagar o campo, e SÓ ele. O gerador recomputa na hora. */
  function voltarAoRecomendado() {
    const novoPerfil = { ...perfil, rotinaCustom: undefined };
    setPerfil(novoPerfil);
    notificarPerfil(novoPerfil);
    const { treino: nt } = recomputarPlano(novoPerfil, opcoesDoPlano());
    setTreino(nt);
    setRotinaDias(nt.rotina?.dias ?? []);
    setEditorDias(null);
    window.scrollTo(0, 0);
  }

  /** Séries semanais JÁ planejadas para um grupo — a base sobre a qual o foco decide. */
  function seriesSemanaisDoGrupo(grupo: string): number {
    let n = 0;
    for (const d of rotinaDias) for (const sl of d.slots) if (sl.exercicio.grupoPrimario === grupo) n += sl.series ?? 0;
    return n;
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
    /**
     * 🔒 O denominador do cartão é o que o PLANO prescreve (DF 2026-08-01).
     *
     * 🔴 D4 (2026-09-10): isto somava `diasCardio[].minutos` — o ENTREGUE — e chamava de
     * "prescrito". Medido: prescrição de 160 min, entrega de 123, e a barra fechava 123/123.
     * A prescrição real é `rotina.cardioSemana.prescritoSegundos`; o que falta aparece na
     * faixa de avisos do motor (`AvisosMotor`), com os três números.
     */
    prescritoMin: treino.rotina?.cardioSemana
      ? Math.round(treino.rotina.cardioSemana.prescritoSegundos / 60) || undefined
      : undefined,
    // 🔒 C3: com todos os dias oferecidos virando força, não sobra dia de cardio — e o cartão
    // precisa DESCREVER esse arranjo em vez de cobrar uma meta que o plano não prescreveu.
    diasDeForca: treino.rotina?.diasForcaAgendados ?? 0,
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
  const nSessoesResistidas = sessoesResistidas(sessoes).length;
  const portaoTecnicas = elegibilidade({
    nivel: perfil.nivelExperiencia,
    sessoesResistidas: nSessoesResistidas,
    comportamentoGate: dieta.gate.comportamento,
    regressaoAtiva: [...feedbackAgregadoPorGrupo(sessoes, hojeISO(), (id) => EXERCISES_SEED.find((e) => e.id === id)).values()].some((f) => f === 'segura'),
    ligado: true,
  }).elegivel;
  const tecnicasLiberadas = portaoTecnicas && (perfil.tecnicasAvancadas ?? false);
  /**
   * 🎛️ v3 · Bloco C — o PORTÃO ABRIU. Emitido na VIRADA (o ref guarda o estado anterior), não
   * a cada render: um evento por quadro inflaria a métrica e ainda mediria render, não
   * elegibilidade.
   *
   * 🔑 Mede quantos CHEGAM ao portão — o denominador honesto de qualquer taxa de adoção. Sem
   * ele, "poucos usam técnicas" não distingue "poucos querem" de "poucos podem".
   */
  const portaoAntesRef = useRef<boolean | null>(null);
  useEffect(() => {
    const antes = portaoAntesRef.current;
    portaoAntesRef.current = portaoTecnicas;
    if (antes === false && portaoTecnicas) {
      registrarEvento('tecnica_elegivel', { sessoes: nSessoesResistidas, nivel: perfil.nivelExperiencia });
    }
  }, [portaoTecnicas, nSessoesResistidas, perfil.nivelExperiencia]);
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

  /** Uma única fotografia das entradas efetivas para motor, tela e certificado. */
  function entradaDoPlano(
    novoPerfil: PerfilResumo,
    sobrescrever?: { pesoEfetivoKg?: number; diasOferecidosCardio?: Weekday[] },
  ) {
    const opcoes = opcoesDaSemana();
    const retomadaAtual = 'retomada' in opcoes ? opcoes.retomada : undefined;
    return normalizarEntradaPlanoVisivel(novoPerfil, {
      pesoEfetivoKg: sobrescrever?.pesoEfetivoKg ?? pesoMotorKg,
      diasOferecidosCardio: sobrescrever?.diasOferecidosCardio ?? diasOferecidosCardio,
      semanaCiclo: {
        semana: opcoes.semana,
        feedbackGrupos: [...(opcoes.feedbackGrupos?.entries() ?? [])],
        ...(retomadaAtual
          ? {
              retomada: {
                ...retomadaAtual,
                exerciciosRecentes: [...(retomadaAtual.exerciciosRecentes ?? [])],
              },
            }
          : {}),
      },
      escolhasExecucao: [...escolhasExecucaoRef.current.entries()],
    });
  }

  /** Todo recompute do Painel recebe a mesma fotografia que será certificada. */
  function opcoesDoPlano(
    sobrescrever?: { pesoEfetivoKg?: number; diasOferecidosCardio?: Weekday[] },
  ) {
    return opcoesDeEntradaPlano(entradaDoPlano(perfil, sobrescrever));
  }

  /**
   * Toda mudança que recalcula o plano entrega o perfil E a fotografia das entradas efetivas
   * ao mesmo CAS. A oferta de cardio continua fora de `PerfilResumo`: ela é do plano, não uma
   * preferência permanente. Map/Set são convertidos aqui antes de cruzarem a fronteira HTTP.
   */
  function notificarPerfil(
    novoPerfil: PerfilResumo,
    sobrescrever?: { pesoEfetivoKg?: number; diasOferecidosCardio?: Weekday[] },
  ) {
    const entrada = entradaDoPlano(novoPerfil, sobrescrever);
    ultimaEntradaEnviadaRef.current = entrada;
    onPerfilChange?.(novoPerfil, entrada);
  }

  /** Mudança automática só grava se ela alterou de fato o plano que a pessoa vê. */
  function certificarEntradaDinamica(
    novoPerfil: PerfilResumo,
    sobrescrever?: { pesoEfetivoKg?: number; diasOferecidosCardio?: Weekday[] },
  ) {
    const entrada = entradaDoPlano(novoPerfil, sobrescrever);
    if (JSON.stringify(entrada) === JSON.stringify(ultimaEntradaEnviadaRef.current)) return;
    ultimaEntradaEnviadaRef.current = entrada;
    onPerfilChange?.(novoPerfil, entrada);
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
    notificarPerfil(novo);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gravação idempotente da âncora
  }, [ciclo.novaAncoraISO, ciclo.novoDeloadAteISO, ciclo.semanaEfetiva]);
  // Rampa de volume da semana (v2 §1): re-monta a rotina com as séries por slot da semana
  // corrente + feedback agregado por grupo. Roda no mount e quando a semana muda (não em
  // cada registro — troca manual de exercício não é clobrada no meio do uso).
  useEffect(() => {
    const { treino: nt } = recomputarPlano(perfil, opcoesDoPlano());
    setTreino(nt);
    setRotinaDias(nt.rotina?.dias ?? []);
    certificarEntradaDinamica(perfil);
    // Re-monta quando a semana do ciclo OU a rampa de retomada muda. A rampa entra nas deps
    // porque ela nasce depois da hidratação do histórico e pode coincidir com a MESMA semana
    // de ciclo — sem isto, a rotina ficaria com o volume cheio enquanto o chip já diz
    // "Retomada" (bug real, pego no smoke do Bloco 3).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ciclo decide o momento; oferta é a única entrada C1.1-B adicional.
  }, [ciclo.semanaEfetiva, retomada?.semana, retomada?.fator, pesoMotorKg, diasOferecidosCardio]);
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
    const { dieta: nd } = recomputarPlano(perfil, opcoesDoPlano());
    if (nd.gate.comportamento === 'ROTEAR' || !nd.plano) {
      setEncaminhamento(nd.gate.motivos ?? []);
      return;
    }
    setDieta(nd);
    setCardItens(nd.cardapio?.itens ?? []);
    setCardTotais(nd.cardapio?.totais ?? null);
    setMostrarC(nd.gate.comportamento === 'RESTRINGIR' || nd.gate.comportamento === 'PISAR');
    certificarEntradaDinamica(perfil, { pesoEfetivoKg: pesoMotorKg });
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
  /** Crítico do plano salvo: custom mede o desenho; automático recompõe o plano final inteiro. */
  const criticoPlano: Avaliacao | null = (() => {
    if (rotinaDias.length === 0 || !prescricaoEfetiva) return null;
    const ctx = {
      semana: ciclo.semanaEfetiva,
      nivel: perfil.nivelExperiencia,
      objetivo: prescricaoEfetiva.objetivoEfetivo ?? perfil.objetivo,
      tempoPorSessaoMin: perfil.tempoPorSessaoMin,
      // Entrada independente do plano final: o crítico não pode aprender o horizonte do próprio
      // agregado que está tentando validar.
      diasNoHorizonteEsperado: ORDEM_SEMANA.length,
      diasOferecidosCardioEsperados: diasOferecidosCardio,
      diasTreinoEsperados: perfil.treinoDias ?? [],
      diasDaSemanaIdx: (perfil.treinoDias ?? []).map((w) => ORDEM_SEMANA.indexOf(w)),
      seriesPadrao: prescricaoEfetiva.seriesPorExercicio.min,
    };
    const atual = avaliarSemana(
      rotinaDias.map((d) => ({
        nome: d.nome,
        exercicios: d.slots.map((s) => s.exercicio),
        // 🔒 C1 — séries/descanso REAIS (sem preencher o que falta): tempo abstém-se em vez de
        // inventar; o placar usa `ctx.seriesPadrao` (abaixo) como piso de volume.
        series: d.slots.map((s) => seriesDoSlot(s)),
        descansoSeg: d.slots.map((s) => s.descansoSeg),
        holdSeg: d.slots.map((s) => s.holdSeg),
      })),
      ctx,
    );
    if (!perfil.rotinaCustom && treino.rotina?.planoFinalPorDia) {
      const automatico = avaliarRotinaAutomaticaFinal(treino.rotina, ctx);
      return { ...automatico, placar: atual.placar, recomendacoes: atual.recomendacoes,
        avisos: [...automatico.avisos.filter((a) => a.codigo === 'sessao_longa'), ...atual.avisos.filter((a) => a.codigo !== 'sessao_longa')] };
    }
    return atual;
  })();

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
  /**
   * 🪟 AS CAMADAS (aceite 2a): enquanto uma está aberta, o Voltar do navegador a FECHA em vez
   * de sair do app. Registradas todas juntas e por CRITÉRIO — "tudo que se sobrepõe ao painel
   * é camada" — para nenhuma sobreposição nova nascer fora da regra. A ordem aqui não importa:
   * a pilha ordena por instante de abertura, então o Voltar sempre fecha a de cima.
   */
  useCamadaVoltavel(menu, () => setMenu(false), 'menu');
  useCamadaVoltavel(vista === 'compras', () => setVista(null), 'compras');
  useCamadaVoltavel(editando, () => setEditando(false), 'editar-perfil');
  useCamadaVoltavel(registrando, () => setRegistrando(false), 'registrar-treino');
  useCamadaVoltavel(registrandoCardio, () => { setCardioPre(null); setRegistrandoCardio(false); }, 'registrar-cardio');
  useCamadaVoltavel(sessaoDia !== null, () => setSessaoDia(null), 'sessao-guiada');
  useCamadaVoltavel(editorDias !== null, () => setEditorDias(null), 'editor-guiado');
  useCamadaVoltavel(biblioteca !== null, () => setBiblioteca(null), 'biblioteca');
  useCamadaVoltavel(modal !== null, () => { setRecusa(null); setModal(null); }, 'troca');
  useCamadaVoltavel(detalhe !== null, () => { setBanimentoTexto(null); setDetalhe(null); }, 'detalhe');
  useCamadaVoltavel(detalheSessao !== null, () => setDetalheSessao(null), 'detalhe-sessao');
  useCamadaVoltavel(encaminhamento !== null, () => setEncaminhamento(null), 'encaminhamento');

  const irAba = (id: Aba) => { setVista(null); irAbaHist(id); };

  // Edição entrou em zona clínica (ROTEAR) → encaminhamento (tela cheia, fail-safe).
  // Não aplicamos o plano nem mexemos na sessão: o plano válido anterior segue intacto.
  if (encaminhamento) {
    return (
      <div className="ak-app" style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB' }}>
        <Backdrop />
        <EncaminhamentoEdicao motivos={encaminhamento} onRevisar={() => { setEncaminhamento(null); setEditando(true); }} onManter={() => setEncaminhamento(null)} />
      </div>
    );
  }

  // Editar perfil (tela cheia) → recalcular o plano.
  if (editando) {
    return (
      <div className="ak-app" style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB' }}>
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
      <div className="ak-app" style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB' }}>
        <Backdrop />
        {/* 🔒 D18 — o plano INTEIRO vai para o registro. Antes só `diaDeHoje` ia, e ele é
            `undefined` sempre que hoje não é dia agendado: o plano existia, mas a tela só
            oferecia "Montar do zero". `rotinaDias` é a mesma lista que a aba Treino
            desenha, então o que se registra é o que se vê. */}
        <RegistrarTreino
          diaHoje={diaDeHoje}
          diasDoPlano={rotinaDias}
          idxDeHoje={sessaoHojeIdx}
          estadoPlano={rotinaDias.length === 0 ? 'sem-plano' : 'pronto'}
          prescricao={prescricaoEfetiva}
          progresso={progresso}
          exercicioPorId={(id) => EXERCISES_SEED.find((e) => e.id === id)}
          onCalibrar={calibrarExercicios}
          onCancelar={() => setRegistrando(false)}
          onSalvar={salvarTreinoManual}
          onVerHistorico={() => { setRegistrando(false); irAbaHist('historico'); window.scrollTo(0, 0); }}
        />
      </div>
    );
  }

  // Registrar CARDIO (Leva 2 · Bloco 1) — tela cheia, mesmo padrão do registro manual.
  if (registrandoCardio) {
    return (
      <div className="ak-app" style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB', padding: '32px 20px 60px' }}>
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
      <div className="ak-app" style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB' }}>
        <Backdrop />
        <SessaoTreino dia={rotinaDias[sessaoDia]!} prescricao={prescricaoEfetiva} progresso={progresso} deload={deloadAtivo} exercicioPorId={(id) => EXERCISES_SEED.find((e) => e.id === id)} onCalibrar={calibrarExercicios} onSair={() => setSessaoDia(null)} onConcluir={concluirSessao} onRegistrarCardio={salvarCardio} pesoKg={perfil.pesoKg} tecnicasLiberadas={tecnicasLiberadas} />
      </div>
    );
  }

  return (
    <div className="ak-app" style={{ position: 'relative', minHeight: '100vh', background: '#0D2818', color: '#EAE5DB', animation: `evkScreenIn .5s ${EASE}` }}>
      <Backdrop />
      {/* header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(13,40,24,.82)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(234,229,219,.1)' }}>
        <div className="evk-painel-topo" style={{ maxWidth: 1080, margin: '0 auto', padding: '13px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="evk-painel-marca" style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}><Logo size={26} /><Marca size="1.1rem" /></div>
          <nav className="evk-painel-tabs" style={{ flex: 1, minWidth: 0, display: 'flex', gap: 4, overflowX: 'auto', padding: '2px 4px' }}>
            {tabs.map((t) => (
              <button type="button" aria-pressed={aba === t.id && !vista} key={t.id} className="evk-painel-tab" onClick={() => irAba(t.id)} style={{ fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 11, fontWeight: 600, fontSize: '.94rem', transition: 'all .25s ease', borderWidth: 1, borderStyle: 'solid', ...(aba === t.id && !vista ? { background: 'rgba(189,255,0,.12)', color: '#BDFF00', borderColor: 'rgba(189,255,0,.3)' } : { background: 'transparent', color: 'rgba(234,229,219,.8)', borderColor: 'transparent' }) }}>{t.label}</button>
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
                {!modoDiario && <button onClick={() => { setVista('compras'); irAbaHist('dieta'); setMenu(false); }} style={menuBtn(false)}>Lista de compras</button>}
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
            {/* 🎛️ v3.1 — a RECUSA do foco de core, explicada. Sem folga de séries o foco não
                é salvo, e a pessoa precisa saber POR QUE o que ela pediu não valeu: recusa
                silenciosa e aplicação silenciosa são o mesmo defeito. Sem vermelho — pedir
                foco no core é legítimo, só não cabe hoje. */}
            {/* 🔒 B2 — O RAMO DO FOCO, DITO (DF 2026-08-14). Sai do PLANO (`rotina.foco`), não de
                um recompute paralelo: é a mesma decisão que o motor tomou, sem segunda conta.
                Trocar o foco e não ver nada é indistinguível de quebrado — foi isso que
                transformou o 1º teste do autor em ambiguidade. */}
            {fraseDoFoco(treino.rotina) && (
              <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(189,255,0,.07)', border: '1px solid rgba(189,255,0,.22)', borderRadius: 14, padding: '13px 15px', marginBottom: 14 }}>
                <span aria-hidden style={{ fontSize: '.95rem', lineHeight: 1.5 }}>🎯</span>
                <p style={{ margin: 0, flex: 1, fontSize: '.88rem', lineHeight: 1.55, color: 'rgba(234,229,219,.86)' }}>{fraseDoFoco(treino.rotina)}</p>
              </div>
            )}
            {avisoFoco && (
              <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 14, padding: '14px 16px', marginBottom: 18 }}>
                <p style={{ margin: 0, flex: 1, fontSize: '.9rem', lineHeight: 1.55, color: 'rgba(234,229,219,.82)' }}>{avisoFoco}</p>
                <button onClick={() => setAvisoFoco(null)} aria-label="Fechar aviso" style={{ background: 'none', border: 'none', color: 'rgba(234,229,219,.5)', fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1, padding: 2 }}>×</button>
              </div>
            )}
            <SuaSemana
              treinoDias={perfil.treinoDias}
              sessoesNomes={rotinaDias.map((d) => d.nome)}
              onIrSessao={(idx) => (rotinaDias[idx] ? iniciarSessaoGuiada(idx) : irAbaHist('treino'))}
              onVerDieta={() => irAba('dieta')}
              onEditarPerfil={() => setEditando(true)}
              diaExcedente={diaExcedente}
              diasCardio={treino.rotina?.diasCardio ?? []}
              onRegistrarCardio={(item) => { setCardioPre(item ?? null); setRegistrandoCardio(true); window.scrollTo(0, 0); }}
            />
            {/* 🔒 C1.1-B: o seletor controlado nomeia dias reais e fica isolado nesta montagem. */}
            <OfertaCardio
              value={diasOferecidosCardio}
              onChange={(proximaOferta) => {
                setDiasOferecidosCardio(proximaOferta);
                const { treino: nt } = recomputarPlano(perfil, opcoesDoPlano({ diasOferecidosCardio: proximaOferta }));
                setTreino(nt);
                setRotinaDias(nt.rotina?.dias ?? []);
                notificarPerfil(perfil, { diasOferecidosCardio: proximaOferta });
              }}
            />
            <Hoje dieta={dieta} cardTotais={cardTotais} dia={diaDeHoje} mostrarC={mostrarC} onFecharC={() => setMostrarC(false)} onComecar={() => sessaoHojeIdx != null ? iniciarSessaoGuiada(sessaoHojeIdx) : irAbaHist('treino')} onRegistrar={registrarPeso} onRegistrarTreino={() => setRegistrando(true)} deload={deloadAtivo} semanaCiclo={ciclo.semanaEfetiva} onSinalFadiga={sinalizarFadiga} retomada={retomada} />
          </div>
        )}
        {!vista && <AvisosHidratacao avisos={perfil.avisosHidratacao} />}
        {/* 🔒 O cardio aparece mesmo SEM prescrição: quem o gate roteou "registra, mas não
            recebe meta". Sem este ramo, o usuário em ROTEAR veria a aba Treino VAZIA e não
            teria onde registrar — o oposto do que a spec pede. */}
        {/* 🧭 O EDITOR toma a tela inteira quando aberto. 🔒 P0.3: ele só existe DENTRO do
            ramo `prescricao` — em ROTEAR (modo diário) `prescricao` é null, a TreinoTab não
            renderiza, e o editor é inalcançável pelo MESMO mecanismo das demais superfícies
            de treino (nenhuma checagem nova a manter em dia). */}
        {!vista && aba === 'treino' && prescricao && editorDias && (
          <EditorTreino
            inicial={editorDias}
            exercises={EXERCISES_SEED}
            ctxSeletor={{
              equipamento: perfil.equipamento,
              equipamentosCasa: perfil.equipamentosCasa,
              nivelExperiencia: perfil.nivelExperiencia,
              favoritos: favoritosSet,
              banidos: new Set(perfil.preferencias?.banidos ?? []),
            }}
            nivel={perfil.nivelExperiencia}
            objetivo={prescricao.objetivoEfetivo ?? perfil.objetivo}
            tempoPorSessaoMin={perfil.tempoPorSessaoMin}
            preverPlano={preverPlano}
            temCustom={!!perfil.rotinaCustom}
            onSalvar={salvarTreinoCustom}
            onCancelar={() => setEditorDias(null)}
            onVoltarAoRecomendado={voltarAoRecomendado}
            onDesbanir={desbanirExercicio}
            onAvisoMostrado={(codigos) => { for (const codigo of codigos) registrarEvento('aviso_risco_mostrado', { codigo, contexto: 'editor' }); }}
          />
        )}
        {!vista && aba === 'treino' && !editorDias && (prescricao
          ? <TreinoTab dias={rotinaDias} rotina={treino.rotina ?? null} tempoPorSessaoMin={perfil.tempoPorSessaoMin} prescricao={prescricaoEfetiva ?? prescricao} treinoNome={treino.rotina?.split ?? 'Treino'} trocados={trocados} feedback={feedback} progresso={progresso} favoritos={favoritosSet} onToggleFavorito={toggleFavorito} onTrocar={abrirTrocaEx} onFb={(k, f) => setFeedback((p) => ({ ...p, [k]: f }))} onIniciar={(d) => iniciarSessaoGuiada(d)} onDetalhe={(d, s) => setDetalhe({ tipo: 'ex', d, s })} onRegistrarTreino={() => setRegistrando(true)} avisoPausa={avisoPausa} onReconhecerPausa={reconhecerPausa} cardio={propsCardio} onMontar={abrirEditor} criticoPlano={criticoPlano} />
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
        {!vista && aba === 'dieta' && !modoDiario && <DietaTab dieta={dieta} itens={cardItens} totais={cardTotais} trocados={trocados} logs={registro.logs} notes={registro.notes} dataHoje={dataHoje} onStatus={registro.setStatus} onNote={registro.setNote} onTrocar={abrirTrocaPrato} onPorcao={(idx) => setModal({ tipo: 'porcao', idx, base: cardItens[idx]!.prato.nome })} onCompras={() => setVista('compras')} onDetalhe={(idx) => setDetalhe({ tipo: 'prato', idx })} descanso={pratosDescanso} onTrazerDeVolta={trazerDeVoltaPrato} orcamento={perfil.orcamento ?? null} onOrcamento={mudarOrcamento} />}
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
              onVerTreino={() => { irAbaHist('treino'); window.scrollTo(0, 0); }}
            />
          </Progresso>
        )}
        {!vista && aba === 'historico' && <Historico sessoes={sessoes} pesos={pesosKg} refeicoes={refeicoesDia} logs={registro.logs} notes={registro.notes} onAbrir={(s) => setDetalheSessao(s)} onComecarTreino={() => modoDiario ? setRegistrando(true) : rotinaDias[0] ? iniciarSessaoGuiada(0) : irAbaHist('treino')} onVerDieta={() => irAba('dieta')} onRegistrarTreino={() => setRegistrando(true)} modoDiario={modoDiario} />}
        {!vista && aba === 'perfil' && <Perfil perfil={perfil} onConta={() => router.push('/conta')} onEditar={() => setEditando(true)} modoDiario={modoDiario} />}
      </div>

      {modal && <ModalTroca modal={modal} recusaTexto={recusa} onFechar={() => { setRecusa(null); setModal(null); }} onAplicarPrato={aplicarPrato} onMaisPrato={maisVariedadePrato} onAplicarPorcao={aplicarPorcao} onAplicarEx={aplicarEx} onMaisEx={maisVariedadeEx} onBiblioteca={(d, s) => { setRecusa(null); setModal(null); setBiblioteca({ d, s }); }} />}
      {/* 🔎 DF③ — a mesma peça do editor, aberta pelo TROCAR. A escolha passa por
          `aplicarEx`, que é quem consulta os trilhos: a biblioteca inteira NÃO é atalho
          para furar preservação/equipamento/nível — é só uma lista maior para escolher. */}
      {biblioteca && rotinaDias[biblioteca.d]?.slots[biblioteca.s] && (
        <SeletorExercicio
          exercises={EXERCISES_SEED}
          ctx={{
            equipamento: perfil.equipamento,
            equipamentosCasa: perfil.equipamentosCasa,
            nivelExperiencia: perfil.nivelExperiencia,
            favoritos: favoritosSet,
            banidos: new Set(perfil.preferencias?.banidos ?? []),
          }}
          grupoInicial={rotinaDias[biblioteca.d]!.slots[biblioteca.s]!.exercicio.grupoPrimario ?? null}
          /* 🔒 D19 — a troca é a OUTRA porta para o mesmo dia: trocar o slot s por um
             exercício que já ocupa outro slot do MESMO dia produz exatamente a duplicata
             que a trava existe para impedir. O slot em troca fica de fora da marcação (é o
             que está saindo) e nenhum outro dia é consultado. */
          jaAdicionados={identidadesDe(
            rotinaDias[biblioteca.d]!.slots
              .filter((_, i) => i !== biblioteca.s)
              .map((sl) => sl.exercicio),
          )}
          onEscolher={(ex) => { const { d, s } = biblioteca; setBiblioteca(null); aplicarEx(d, s, ex); }}
          onDesbanir={(id) => desbanirExercicio(id)}
          onFechar={() => setBiblioteca(null)}
        />
      )}
      {detalhe?.tipo === 'prato' && cardItens[detalhe.idx] && (
        <DetalhePrato item={cardItens[detalhe.idx]!} foodsById={FOODS_BY_ID_SEED} onFechar={() => setDetalhe(null)} onTrocar={() => { const idx = detalhe.idx; setDetalhe(null); abrirTrocaPrato(idx); }} onPorcao={() => { const idx = detalhe.idx; setDetalhe(null); setModal({ tipo: 'porcao', idx, base: cardItens[idx]!.prato.nome }); }} onCansei={() => cansarDoPrato(cardItens[detalhe.idx]!.prato.id)} />
      )}
      {detalhe?.tipo === 'ex' && rotinaDias[detalhe.d]?.slots[detalhe.s] && (
        <DetalheExercicio
          ex={exercicioEfetivo(rotinaDias[detalhe.d]!.slots[detalhe.s]!.exercicio.id, progresso, (id) => EXERCISES_SEED.find((e) => e.id === id)) ?? rotinaDias[detalhe.d]!.slots[detalhe.s]!.exercicio}
          favoritado={favoritosSet.has(rotinaDias[detalhe.d]!.slots[detalhe.s]!.exercicio.id)}
          onToggleFavorito={() => toggleFavorito(rotinaDias[detalhe.d]!.slots[detalhe.s]!.exercicio.id)}
          onFechar={() => { setBanimentoTexto(null); setDetalhe(null); }}
          onTrocar={() => { const { d, s } = detalhe; setDetalhe(null); abrirTrocaEx(d, s); }}
          onBanir={() => banirExercicio(rotinaDias[detalhe.d]!.slots[detalhe.s]!.exercicio.id)}
          banidoTexto={banimentoTexto}
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

/**
 * 🔴 D14 (auditoria 2026-09-11) — A AGENDA SOLICITADA × A ENTREGA EFETIVA.
 *
 * Medido no snapshot `a40f8af`: um dia de força com `slots: []` era entregue como sessão,
 * contado em `diasForcaAgendados` e media 0 s — sustentando o selo verde de "cabe nos
 * limites". A pessoa podia abrir e iniciar uma sessão sem nenhum exercício.
 *
 * 🔒 O dia NÃO some do plano: ele sai da lista de sessões e aparece aqui, nomeado e com o
 * motivo. Nada é redistribuído para tapar o buraco — cardio não ocupa o dia e exercício fora
 * do equipamento declarado continua fora.
 */
function DiasNaoAtendidos({ dias }: { dias?: DiaNaoAtendido[] }) {
  if (!dias || dias.length === 0) return null;
  const porque = (m: DiaNaoAtendido['motivo']) =>
    m === 'EQUIPAMENTO' ? 'com o equipamento que você marcou no perfil, não há exercício novo para este dia'
      : m === 'TETO_SEMANAL' ? 'os grupos deste dia já alcançaram o volume previsto para a semana'
        : 'o desenho deste dia ficou sem exercício disponível';
  return (
    <section
      aria-label="Dias da sua agenda que não viraram sessão"
      style={{ background: 'rgba(13,40,24,.4)', border: '1px solid rgba(234,179,8,.45)', borderRadius: 16, padding: 15, marginBottom: 16 }}
    >
      <p role="status" style={{ margin: '0 0 6px', fontSize: '.9rem', fontWeight: 600, lineHeight: 1.5, color: 'rgba(234,229,219,.9)' }}>
        <span aria-hidden style={{ marginRight: 6 }}>🟡</span>
        {dias.length === 1 ? 'Um dia da sua agenda não virou sessão nesta semana.' : `${dias.length} dias da sua agenda não viraram sessão nesta semana.`}
      </p>
      <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: '.86rem', lineHeight: 1.55, color: 'rgba(234,229,219,.8)' }}>
        {dias.map((d, i) => (
          <li key={`${d.nome}-${i}`}>
            <strong>{d.diaId ? DIA_LABEL[d.diaId].full : d.nome}</strong>
            {d.diaId ? ` · ${d.nome}` : ''} — {porque(d.motivo)}.
          </li>
        ))}
      </ul>
      <p style={{ margin: '10px 0 0', fontSize: '.84rem', lineHeight: 1.5, color: 'rgba(234,229,219,.65)' }}>
        Seus dias continuam como você marcou no perfil. Não movemos o treino para outro dia nem colocamos exercício
        que não cabe no seu equipamento só para preencher.
      </p>
    </section>
  );
}

function TreinoTab({ dias, prescricao, treinoNome, trocados, feedback, progresso, favoritos, onToggleFavorito, onTrocar, onFb, onIniciar, onDetalhe, onRegistrarTreino, avisoPausa, onReconhecerPausa, cardio, onMontar, criticoPlano, rotina, tempoPorSessaoMin }: {
  dias: DiaTreino[]; prescricao: NonNullable<ResultadoTreino['prescricao']>; treinoNome: string;
  trocados: Set<string>; feedback: Record<string, Feedback>; progresso?: Record<string, ProgressoExercicio>;
  favoritos: Set<string>; onToggleFavorito: (id: string) => void;
  onTrocar: (d: number, s: number) => void; onFb: (k: string, f: Feedback) => void;
  onIniciar: (d: number) => void; onDetalhe: (d: number, s: number) => void; onRegistrarTreino: () => void;
  /** "Fiquei doente" (Bloco 4): aviso "Pausa reconhecida" — já resolvido pela precedência. */
  avisoPausa: boolean; onReconhecerPausa: () => void;
  /** 🧭 Editor guiado — a porta "Montar meu treino" (só existe onde há prescrição). */
  onMontar: () => void;
  /** Crítico visível do plano salvo: editor ou recomposição independente do automático final. */
  criticoPlano: Avaliacao | null;
  rotina: RotinaSemanal | null;
  tempoPorSessaoMin: number;
  /** Cardio (Bloco 1): a seção da semana mora na aba Treino, como o design desenhou. */
  cardio: {
    registros: readonly RegistroCardioDatado[]; meta: MetaCardio | null;
    retomada?: { semana: number; totalSemanas: number } | null;
    hojeISO: string; acumuladoMin: number; objetivo: PerfilResumo['objetivo']; onRegistrar: () => void;
  };
}) {
  const total = dias.reduce((n, d) => n + d.slots.length, 0);
  const [diaSelecionado, setDiaSelecionado] = useState(0);
  useEffect(() => {
    if (diaSelecionado >= dias.length) setDiaSelecionado(0);
  }, [diaSelecionado, dias.length]);
  const series = (slot: DiaTreino['slots'][number]) => seriesDoSlot(slot);
  return (
    <div style={sec}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        <div><div style={{ ...kicker, color: '#BDFF00', marginBottom: 6 }}>Plano de treino</div><h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-.02em' }}>{treinoNome}</h2></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.55)', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 999, padding: '7px 14px' }}>{total} exercícios · {dias.reduce((n, d) => n + d.slots.reduce((sum, slot) => sum + series(slot), 0), 0)} séries na semana</span>
          {/* Entrada A2 do registro manual (handoff): no header da aba Treino. */}
          <button onClick={onRegistrarTreino} className="evk-registrar" style={{ background: 'none', border: '1px solid rgba(189,255,0,.4)', color: '#BDFF00', fontWeight: 600, fontSize: '.94rem', padding: '12px 20px', borderRadius: 12, cursor: 'pointer' }}>Já treinei — registrar</button>
          {/* 🧭 A porta do EDITOR (pedido nº 5). Render incondicional dentro da aba — a
              regra da descobribilidade de 2026-08-08: controle atrás de condição some. */}
          <button onClick={onMontar} style={{ background: '#BDFF00', border: '1px solid #BDFF00', color: '#0D2818', fontWeight: 600, fontSize: '.94rem', padding: '12px 20px', borderRadius: 12, cursor: 'pointer' }}>Montar meu treino</button>
        </div>
      </div>
      {/* 🧭 DF② — a faixa compacta do crítico no plano JÁ SALVO: os avisos ativos + 1
          recomendação, no mesmo componente do editor. */}
      {/* 🔴 D1 — a saída do MOTOR (veredito da geração + avisos honestos + conta do cardio).
          Vem antes do crítico de propósito: o crítico fala do DESENHO da semana; este fala do
          que a geração conseguiu (ou não) entregar. */}
      <AvisosMotor rotina={rotina} tempoPorSessaoMin={tempoPorSessaoMin} avisos={unificarAvisos(rotina, criticoPlano && { recomendacoes: recomendacoesVisiveis(criticoPlano, true), avisos: criticoPlano.avisos }).avisosMotor} />
      {/* 🔴 D14 — o dia PEDIDO que não virou sessão continua na tela, com o motivo. O que ele
          não tem é botão de iniciar ou registrar: não existe sessão vazia para começar. */}
      <DiasNaoAtendidos dias={rotina?.diasNaoAtendidos} />
      {criticoPlano && <section aria-label="Avaliação semanal do plano"><p style={{ fontSize: ".84rem", color: "rgba(234,229,219,.75)" }}>Resumo da semana inteira — atualizado ao alterar exercícios ou séries. Selecionar um dia não altera esta avaliação.</p><PainelCritico avaliacao={criticoPlano} compacto /></section>}
      {/* O aviso entra entre o cabeçalho da aba e a lista — e a lista abaixo é EXATAMENTE a
          mesma de quem não avisou (nada avançou, nada foi remarcado). */}
      {avisoPausa && <AvisoPausaReconhecida />}
      {dias.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ marginBottom: 10, fontSize: '.78rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)' }}>Escolha o dia</div>
          <div role="tablist" aria-label="Dias do plano de treino" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 0 8px', scrollbarWidth: 'thin' }}>
            {dias.map((dia, d) => {
              const selecionado = d === diaSelecionado;
              return (
                <button
                  key={`${dia.nome}-${d}`}
                  type="button"
                  role="tab"
                  id={`treino-dia-tab-${d}`}
                  aria-selected={selecionado}
                  aria-controls={`treino-dia-painel-${d}`}
                  onClick={() => setDiaSelecionado(d)}
                  tabIndex={selecionado ? 0 : -1}
                  onKeyDown={(e) => {
                    const alvo = e.key === 'ArrowRight' ? (d + 1) % dias.length : e.key === 'ArrowLeft' ? (d + dias.length - 1) % dias.length : e.key === 'Home' ? 0 : e.key === 'End' ? dias.length - 1 : null;
                    if (alvo != null) { e.preventDefault(); setDiaSelecionado(alvo); document.getElementById('treino-dia-tab-' + alvo)?.focus(); }
                  }}
                  style={{ minWidth: 150, flex: '1 0 150px', maxWidth: 230, textAlign: 'left', cursor: 'pointer', borderRadius: 13, padding: '12px 14px', transition: 'border-color .2s ease, background .2s ease, color .2s ease', border: `1px solid ${selecionado ? 'rgba(189,255,0,.48)' : 'rgba(234,229,219,.12)'}`, background: selecionado ? 'rgba(189,255,0,.1)' : 'rgba(234,229,219,.035)', color: selecionado ? '#BDFF00' : '#EAE5DB' }}
                >
                  <span style={{ display: 'block', fontSize: '.72rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', opacity: selecionado ? 1 : .8, marginBottom: 4 }}>{dia.diaId ? DIA_LABEL[dia.diaId].full : `Dia ${d + 1}`}</span>
                  <span style={{ display: 'block', fontSize: '.92rem', lineHeight: 1.25, fontWeight: 700 }}>{dia.nome}</span>
                  <span style={{ display: 'block', marginTop: 5, fontSize: '.75rem', color: selecionado ? 'rgba(189,255,0,.72)' : 'rgba(234,229,219,.8)' }}>{dia.slots.length} exercícios · {dia.slots.reduce((n, s) => n + series(s), 0)} séries</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {dias.map((dia, d) => (
        <section role="tabpanel" aria-labelledby={`treino-dia-tab-${d}`} id={`treino-dia-painel-${d}`} key={`${dia.nome}-${d}`} hidden={diaSelecionado !== d}>
        <div key={`${dia.nome}-${d}`} style={{ marginBottom: 22 }}>
          <h3 style={{ margin: '0 0 16px' }}>{dia.slots.reduce((n, s) => n + series(s), 0)} séries planejadas neste dia</h3>
          <ResumoSeries slots={dia.slots.map((slot) => ({ exercicio: slot.exercicio, series: series(slot) }))} />
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
                      <div className="ak-exercise-heading" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                          {/* 🔒 C1 — O GRUPO MUSCULAR NO CARD (pedido do autor, 2026-08-14):
                              *"acho bom colocar do lado de cada exercício que grupo muscular
                              ele aborda"*. O card mostrava só o PADRÃO (EMPURRAR/ISOLADO), que
                              é vocabulário do motor, não do usuário. O grupo vem primeiro e em
                              destaque; o padrão fica como informação secundária. Os
                              SECUNDÁRIOS ("pega bíceps também") vivem no detalhe, que é onde
                              cabe explicar por que um exercício conta para mais de um grupo. */}
                          {efetivo.grupoPrimario && (
                            <span style={{ ...kicker, color: 'rgba(189,255,0,.75)' }}>{ROTULO_GRUPO[efetivo.grupoPrimario] ?? efetivo.grupoPrimario}</span>
                          )}
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
                        <span style={pill}>{series(sl)} séries × {reps.min}–{reps.max} reps</span>
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
        </section>
      ))}
      {/* 🔴 D15 (auditoria 2026-09-11) — A REGRA DE INICIANTE SEGUE O CAMPO DA PRESCRIÇÃO.
          Esta frase era renderizada INCONDICIONALMENTE: o intermediário e o avançado liam a
          cláusula do iniciante sobre falha como se fosse a regra deles, e
          `prescricao.semFalhaIniciante` — que existe exatamente para carregar esta regra —
          tinha ZERO consumidores em `src/components` + `src/app`.
          🔒 O que é geral continua geral (o retorno ajusta o treino; a carga sobe por dupla
          progressão). O que muda é só a cláusula do iniciante. Para os outros níveis NÃO
          entra recomendação de falha nenhuma: o motor não prescreve isso, e inventar aqui
          seria trocar um texto errado por outro. */}
      <p style={{ margin: '4px 2px 0', fontSize: '.88rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.55 }}>
        {prescricao.semFalhaIniciante
          ? 'Seu retorno ajusta o próximo treino. Iniciante não treina até a falha — a carga sobe por dupla progressão guiada pelo seu feedback.'
          : 'Seu retorno ajusta o próximo treino. A carga sobe por dupla progressão guiada pelo seu feedback.'}
      </p>
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

function DietaTab({ dieta, itens, totais, trocados, logs, notes, dataHoje, onStatus, onNote, onTrocar, onPorcao, onCompras, onDetalhe, descanso, onTrazerDeVolta, orcamento, onOrcamento }: {
  dieta: ResultadoMotor; itens: CardapioItem[]; totais: RecipeMacros | null; trocados: Set<string>;
  logs: Record<string, StatusRefeicao>; notes: Record<string, string>; dataHoje: string;
  onStatus: (id: string, s: StatusRefeicao) => void; onNote: (id: string, txt: string) => void;
  onTrocar: (idx: number) => void; onPorcao: (idx: number) => void; onCompras: () => void; onDetalhe: (idx: number) => void;
  descanso: { id: string; nome: string; ate: string }[]; onTrazerDeVolta: (id: string) => void;
  orcamento: Orcamento | null; onOrcamento: (v: Orcamento | null) => void;
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
      {/* 💰 A PORTA na superfície que a spec nomeia ("preferências da dieta"). Renderizada
          SEM condicional de propósito: a mini-leva nasceu porque um `{onOrcamento && …}`
          apagou o controle do onboarding em silêncio. */}
      <div style={{ marginTop: 22 }}>
        <SeletorOrcamento valor={orcamento} onEscolher={onOrcamento} />
      </div>
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
    return <button type="button" aria-pressed={on} key={id} onClick={() => setSub(id)} style={{ cursor: 'pointer', whiteSpace: 'nowrap', padding: '9px 16px', borderRadius: 11, fontWeight: 600, fontSize: '.9rem', transition: 'all .25s ease', border: `1px solid ${on ? '#BDFF00' : 'rgba(234,229,219,.14)'}`, background: on ? 'rgba(189,255,0,.1)' : 'rgba(234,229,219,.03)', color: on ? '#BDFF00' : 'rgba(234,229,219,.62)' }}>{label}</button>;
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
                  <div key={chaveSessao(w)} style={{ ...cardSoft, padding: '18px 20px' }}>
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
                  <div key={chaveSessao(w)} style={{ ...cardSoft, padding: '18px 20px' }}>
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
                <div key={chaveSessao(w)} onClick={() => onAbrir(w)} className="hov-lift" style={{ ...cardSoft, padding: '18px 20px', cursor: 'pointer' }}>
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
          {linha('Alergias', perfil.alergenos.length ? perfil.alergenos.join(', ') : 'nenhuma')}
          {/* 💰 O irmão que faltava. Vazio EXPLÍCITO como em "Alergias: nenhuma" — linha
              omitida foi exatamente o que fez o controle parecer inexistente. */}
          {linha('Orçamento', ROTULO_ORCAMENTO[perfil.orcamento ?? 'nenhum'], true)}
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
          <p style={{ margin: 0, fontSize: '.8rem', color: 'rgba(234,229,219,.42)', lineHeight: 1.6 }}>O Adaptkorpus é uma ferramenta de uso geral e caráter educacional, dirigida pelo usuário. Não constitui prescrição, consulta ou acompanhamento nutricional ou de educação física, nem substitui a orientação de profissionais habilitados. Conteúdo para maiores de 18 anos.</p>
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

function ModalTroca({ modal, recusaTexto, onFechar, onAplicarPrato, onMaisPrato, onAplicarPorcao, onAplicarEx, onMaisEx, onBiblioteca }: {
  /** 🎛️ v3 · Bloco A: a explicação da preferência recusada (null = nenhuma recusa). */
  recusaTexto?: string | null;
  modal: NonNullable<Modal>; onFechar: () => void;
  onAplicarPrato: (idx: number, o: OpcaoPrato) => void; onMaisPrato: () => void;
  onAplicarPorcao: (idx: number, f: number) => void;
  onAplicarEx: (d: number, s: number, ex: Exercise) => void; onMaisEx: () => void;
  /** 🔎 DF③ — a SEGUNDA PORTA do seletor: "ver a biblioteca completa" (só em exercício). */
  onBiblioteca?: (d: number, s: number) => void;
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
        {/* 🎛️ v3 · Bloco A: a RECUSA aparece aqui, com a razão. Preferência recusada em
            silêncio é a mesma coisa que preferência ignorada — e o cofre proíbe as duas.
            Sem vermelho: recusar um pedido legítimo não é erro da pessoa. */}
        {recusaTexto && (
          <p role="status" style={{ margin: '-8px 0 18px', fontSize: '.88rem', lineHeight: 1.5, color: 'rgba(234,229,219,.82)', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 12, padding: '11px 13px' }}>{recusaTexto}</p>
        )}
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
        {/* 🔎 DF③ (2026-08-13) — a segunda porta do seletor. Fica ABAIXO das sugestões: o
            caminho curto (3 equivalentes, filtro duro de preservação) continua sendo o
            default; a biblioteca inteira é a saída de quem quer escolher por conta. */}
        {modal.tipo === 'exercicio' && onBiblioteca && (
          <button onClick={() => onBiblioteca(modal.d, modal.s)} style={{ width: '100%', marginTop: 10, background: 'none', border: '1px solid rgba(234,229,219,.2)', color: '#EAE5DB', fontWeight: 600, fontSize: '.9rem', padding: 12, borderRadius: 12, cursor: 'pointer' }}>
            Ver a biblioteca completa
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
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-label="Adaptkorpus">
      <line x1={28} y1={16} x2={28} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" /><line x1={29} y1={50} x2={68} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" />
      <path d="M33 50 Q50 38 70 18" stroke="#BDFF00" strokeWidth={3.5} fill="none" strokeLinecap="round" /><circle cx={35} cy={50} r={4.5} fill="#BDFF00" /><circle cx={52} cy={35} r={5} fill="#BDFF00" /><circle cx={70} cy={18} r={6} fill="#BDFF00" />
    </svg>
  );
}
const Marca = ({ size }: { size: string }) => <span style={{ fontWeight: 800, fontSize: size, letterSpacing: '-.02em' }}><span style={{ color: '#EAE5DB' }}>adapt</span><span style={{ color: '#BDFF00', marginLeft: '0.02em' }}>korpus</span></span>;

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
