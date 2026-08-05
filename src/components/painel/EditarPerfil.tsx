'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import type { PerfilResumo } from './Painel';
import { gerarTreino } from '@/lib/engine';
import type { ComportamentoGate, NivelAtividade, NivelExperiencia, Objetivo, Sexo } from '@/lib/engine';
import { elegibilidade } from '@/lib/engine/tecnicas-avancadas';
import type { Alergeno, EquipamentoCasa, EquipamentoDisp } from '@/lib/data/types';
import { diasPadrao, ORDEM_SEMANA, type Weekday } from '@/lib/semana';
import { ChecklistEquipamento, SeletorDias, PreferenciasAlimentares } from '@/components/perfil/DiasEPreferencias';
import { ExerciciosBanidos, MeusFavoritos, ToastDesfazer } from './Favoritos';
import { elegibilidadeFavorito } from '@/lib/favoritos-elegibilidade';
import { lerHistorico } from '@/lib/treino-historico';
import { EXERCISES_SEED } from '@/lib/data/seed';

/**
 * Editar perfil — porte fiel do protótipo V2 (.dc.html). Coleta os mesmos campos do
 * onboarding e, ao salvar, abre o modal "Recalcular plano?". A confirmação chama
 * onSalvar(novoPerfil); o Painel recalcula dieta+treino com o motor determinístico real.
 *
 * Alterar peso/objetivo/disponibilidade recalcula o plano (regra do cofre). A triagem de
 * saúde (flagsSaude) é preservada do perfil atual — não é reaberta neste formulário.
 */

const EASE = 'cubic-bezier(.22,.61,.36,1)';

const OBJETIVOS: { id: Objetivo; t: string; d: string }[] = [
  { id: 'emagrecimento', t: 'Emagrecer', d: 'Reduzir gordura com constância.' },
  { id: 'massa', t: 'Ganhar massa', d: 'Construir músculo de forma estruturada.' },
  { id: 'saude', t: 'Manter / Saúde', d: 'Manutenção e bem-estar no longo prazo.' },
];
const ATIVIDADES: { id: NivelAtividade; t: string; d: string }[] = [
  { id: 'sedentario', t: 'Sedentário', d: 'Pouco ou nenhum exercício' },
  { id: 'leve', t: 'Leve', d: '1–2 dias por semana' },
  { id: 'moderado', t: 'Moderado', d: '3–4 dias por semana' },
  { id: 'intenso', t: 'Intenso', d: '5–6 dias por semana' },
  { id: 'muito_intenso', t: 'Muito intenso', d: 'Treino diário / trabalho físico' },
];
const EXPERIENCIAS: { id: NivelExperiencia; t: string; d: string }[] = [
  { id: 'iniciante', t: 'Iniciante', d: 'Começando agora ou voltando.' },
  { id: 'intermediario', t: 'Intermediário', d: 'Treino há alguns meses.' },
  { id: 'avancado', t: 'Avançado', d: 'Treino consistente há anos.' },
];
// Modelo 2 NÍVEIS (DF 2026-07-04): Casa (com checklist) ou Academia.
const LOCAIS: { id: EquipamentoDisp; t: string; d: string }[] = [
  { id: 'casa', t: 'Em casa', d: 'Marque abaixo o que você tem — ou nada: só o peso do corpo também funciona.' },
  { id: 'academia', t: 'Academia', d: 'Acesso completo a máquinas e pesos.' },
];
const PADROES: { id: '' | 'vegetariano' | 'vegano'; t: string; d: string }[] = [
  { id: '', t: 'Onívoro', d: 'Como de tudo.' },
  { id: 'vegetariano', t: 'Vegetariano', d: 'Sem carnes.' },
  { id: 'vegano', t: 'Vegano', d: 'Sem origem animal.' },
];
export default function EditarPerfil({ inicial, onCancelar, onSalvar, modoDiario, sessoesResistidas = 0, comportamentoGate = 'PERMITIR', regressaoAtiva = false }: {
  inicial: PerfilResumo;
  onCancelar: () => void;
  onSalvar: (novo: PerfilResumo) => void;
  /**
   * 🔒 Insumos do PORTÃO das técnicas avançadas (Leva F, §🥊). Vêm do Painel, que tem o
   * histórico — a tela não conta sessão nem lê gate por conta própria. Defaults conservadores
   * (0 sessões, sem regressão) mantêm o portão FECHADO quando o chamador não informa.
   */
  sessoesResistidas?: number;
  comportamentoGate?: ComportamentoGate;
  regressaoAtiva?: boolean;
  /**
   * 🔒 MODO DIÁRIO: some o CONTROLE do modo força, não só o rótulo. Esconder o texto e
   * deixar o toggle transferiria o vazamento para quem o ligasse. O preset é **inerte**
   * aqui — `gerarTreino` devolve `prescricao: null` no gate ROTEAR antes de
   * `prescreverTreino` sequer ser chamado —, então tirar o controle não tira função
   * nenhuma: não é cadeado, é remover um botão que não faz nada.
   */
  modoDiario?: boolean;
}) {
  const [sexo, setSexo] = useState<Sexo>(inicial.sexo);
  const [idade, setIdade] = useState(String(inicial.idade));
  const [altura, setAltura] = useState(String(inicial.alturaCm));
  const [peso, setPeso] = useState(String(inicial.pesoKg));
  const [objetivo, setObjetivo] = useState<Objetivo>(inicial.objetivo);
  const [atividade, setAtividade] = useState<NivelAtividade>(inicial.nivelAtividade);
  const [experiencia, setExperiencia] = useState<NivelExperiencia>(inicial.nivelExperiencia);
  // Modo força (v2 §4, DF 2026-07-08): preset opt-in SÓ interm./avançado (o motor ignora
  // p/ iniciante e o toggle nem aparece — se o nível voltar a iniciante, o flag fica inerte).
  const [modoForca, setModoForca] = useState(inicial.modoForca ?? false);
  /**
   * 🔒 Opt-in das técnicas avançadas — DESLIGADO por padrão (critério 6 do §10.1). O portão
   * de elegibilidade é do MOTOR (`engine/tecnicas-avancadas`); aqui só se lê a resposta, e a
   * tela nunca decide sozinha quem pode.
   */
  const [tecnicas, setTecnicas] = useState(inicial.tecnicasAvancadas ?? false);
  const tecnicasLiberadas = elegibilidade({
    nivel: experiencia, sessoesResistidas, comportamentoGate, regressaoAtiva, ligado: true,
  }).elegivel;
  // 'nenhum' legado (pré-migração) mapeia para casa + checklist vazio.
  const [local, setLocal] = useState<EquipamentoDisp>(inicial.equipamento === 'nenhum' ? 'casa' : inicial.equipamento);
  const [equipsCasa, setEquipsCasa] = useState<EquipamentoCasa[]>(
    inicial.equipamento === 'nenhum' ? [] : (inicial.equipamentosCasa ?? []),
  );
  const toggleEquip = (eq: EquipamentoCasa) => setEquipsCasa((p) => (p.includes(eq) ? p.filter((x) => x !== eq) : [...p, eq]));
  const diasIniciais = inicial.treinoDias?.length ? inicial.treinoDias : diasPadrao(inicial.diasDisponiveis);
  const [treinoDias, setTreinoDias] = useState<Weekday[]>(diasIniciais);
  const [tempo, setTempo] = useState(inicial.tempoPorSessaoMin);
  const [padrao, setPadrao] = useState<'' | 'vegetariano' | 'vegano'>(inicial.preferencia ?? '');
  const [alergias, setAlergias] = useState<Alergeno[]>(inicial.alergenos);
  const [naoCurto, setNaoCurto] = useState<string[]>(inicial.naoCurto ?? []);
  // Favoritos (⭐ V8.2): edição local como o "não gosto" — persiste no Salvar. Remover é
  // reversível por toast (4,5 s; sair da tela = confirma, como o Cancelar descarta tudo).
  const [favoritos, setFavoritos] = useState<string[]>(inicial.favoritos ?? []);
  // 🎛️ v3 · Bloco A: os banidos editam-se aqui, como os favoritos — persistem no Salvar.
  const [banidos, setBanidos] = useState<string[]>([...(inicial.preferencias?.banidos ?? [])]);
  const [removidoFav, setRemovidoFav] = useState<{ id: string; idx: number } | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  const toggleAlergia = (a: Alergeno) => setAlergias((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]));
  const toggleDia = (w: Weekday) => setTreinoDias((p) => (p.includes(w) ? p.filter((x) => x !== w) : [...p, w].sort((x, y) => ORDEM_SEMANA.indexOf(x) - ORDEM_SEMANA.indexOf(y))));
  const addFood = (id: string) => setNaoCurto((p) => (p.includes(id) ? p : [...p, id]));
  const removeFood = (id: string) => setNaoCurto((p) => p.filter((x) => x !== id));
  const removerFavorito = (id: string) => {
    setFavoritos((p) => {
      const idx = p.indexOf(id);
      if (idx === -1) return p;
      setRemovidoFav({ id, idx });
      return p.filter((x) => x !== id);
    });
  };
  const desfazerRemocao = () => {
    setRemovidoFav((r) => {
      if (r) setFavoritos((p) => { const arr = [...p]; arr.splice(Math.min(r.idx, arr.length), 0, r.id); return arr; });
      return null;
    });
  };
  // Elegibilidade dos favoritos no plano DESTE formulário (equipamento/nível/dias em edição):
  // monta a rotina determinística com os campos atuais e avalia cada favorito (B5).
  const rotinaAtual = useMemo(() => {
    const r = gerarTreino(
      { pesoKg: +peso || inicial.pesoKg, alturaCm: +altura || inicial.alturaCm, idade: +idade || inicial.idade, flagsSaude: inicial.flagsSaude, objetivo, nivelExperiencia: experiencia, equipamento: local, equipamentosCasa: local === 'casa' ? equipsCasa : [], diasDisponiveis: treinoDias.length, tempoPorSessaoMin: tempo },
      { exercises: EXERCISES_SEED, favoritos: new Set(favoritos) },
    );
    return r.rotina;
  }, [peso, altura, idade, objetivo, experiencia, local, equipsCasa, treinoDias, tempo, favoritos, inicial]);
  const historicoRef = useMemo(() => lerHistorico(), []);

  const i = +idade, a = +altura, pz = +peso;
  const valido = i >= 18 && i <= 100 && a >= 100 && a <= 250 && pz >= 30 && pz <= 300 && treinoDias.length >= 1;
  // A semana só é "reorganizada" quando os dias de treino mudam (handoff §5.3/§6).
  const diasMudaram = JSON.stringify(treinoDias) !== JSON.stringify(diasIniciais);

  function tentarSalvar() {
    if (!valido) return;
    if (diasMudaram) setConfirmar(true); // dias mudaram → confirma o recálculo/reorganização
    else salvar();                       // só alimentos/outros → salva direto
  }

  function salvar() {
    if (!valido) return;
    onSalvar({
      ...inicial,
      sexo, idade: i, alturaCm: a, pesoKg: pz, objetivo, nivelAtividade: atividade,
      nivelExperiencia: experiencia, equipamento: local, equipamentosCasa: local === 'casa' ? equipsCasa : [],
      diasDisponiveis: treinoDias.length, tempoPorSessaoMin: tempo,
      preferencia: padrao || null, alergenos: alergias, treinoDias, naoCurto, favoritos,
      // 🎛️ v3 · Bloco A: as trocas ficam intactas; só a lista de banidos é editável aqui.
      preferencias: { trocas: inicial.preferencias?.trocas ?? [], banidos },
      modoForca,
      // Desligar vale já na próxima sessão: o valor sai daqui direto para o perfil.
      tecnicasAvancadas: tecnicasLiberadas ? tecnicas : false,
    });
  }

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 22px 56px', animation: `evkScreenIn .5s ${EASE}` }}>
      <div style={{ width: '100%', maxWidth: 620 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}><Logo size={26} /><h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-.02em' }}>Editar perfil</h1></div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'rgba(189,255,0,.07)', border: '1px solid rgba(189,255,0,.25)', borderRadius: 14, padding: '14px 16px', marginBottom: 20 }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx={12} cy={12} r={9} stroke="#BDFF00" strokeWidth={1.7} /><path d="M12 8v5" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" /><circle cx={12} cy={16.2} r={1.1} fill="#BDFF00" /></svg>
          <p style={{ margin: 0, fontSize: '.9rem', color: 'rgba(234,229,219,.78)', lineHeight: 1.55 }}>Alterar <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>peso</strong>, <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>objetivo</strong> ou <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>disponibilidade</strong> recalcula seu plano.</p>
        </div>

        <div style={{ background: 'linear-gradient(168deg, rgba(15,42,26,.55), rgba(15,15,14,.6))', border: '1px solid rgba(234,229,219,.1)', borderRadius: 22, padding: '28px 26px', display: 'flex', flexDirection: 'column', gap: 26 }}>

          <div>
            <div style={cap}>Sexo biológico</div>
            <div style={{ display: 'flex', gap: 10 }}>{(['feminino', 'masculino'] as Sexo[]).map((sx) => <div key={sx} onClick={() => setSexo(sx)} style={{ ...seg, ...(sexo === sx ? segOn : {}) }}>{sx === 'feminino' ? 'Feminino' : 'Masculino'}</div>)}</div>
          </div>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {([['Idade', idade, setIdade, 'anos'], ['Altura', altura, setAltura, 'cm'], ['Peso', peso, setPeso, 'kg']] as const).map(([lb, v, set, u]) => (
              <div key={lb} style={{ flex: 1, minWidth: 120 }}>
                <div style={cap}>{lb}</div>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(234,229,219,.05)', border: '1px solid rgba(234,229,219,.14)', borderRadius: 12, padding: '0 14px' }}><input type="number" inputMode="numeric" value={v} onChange={(e) => set(e.target.value)} style={{ width: '100%', background: 'none', border: 'none', color: '#EAE5DB', fontSize: '1.1rem', fontWeight: 600, padding: '12px 0', outline: 'none' }} /><span style={{ fontSize: '.85rem', color: 'rgba(234,229,219,.45)' }}>{u}</span></div>
              </div>
            ))}
          </div>

          <CardsBloco titulo="Objetivo" opts={OBJETIVOS} sel={objetivo} onSel={setObjetivo} />
          <CardsBloco titulo="Nível de atividade" opts={ATIVIDADES} sel={atividade} onSel={setAtividade} desc />
          <div>
            <CardsBloco titulo="Experiência de treino" opts={EXPERIENCIAS} sel={experiencia} onSel={setExperiencia} desc />
            {/* Modo força (v2 §4): visível SÓ p/ intermediário/avançado — 6 reps fixas nos
                compostos, progressão só por carga (rumo ao 6RM). Mesmo padrão do switch %1RM. */}
            {experiencia !== 'iniciante' && !modoDiario && (
              <div style={{ marginTop: 14, background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 13, padding: '13px 16px' }}>
                <div onClick={() => setModoForca((v) => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '.92rem', fontWeight: 500, color: 'rgba(234,229,219,.85)' }}>Modo força</span>
                    <span style={{ display: 'block', fontSize: '.78rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.45, marginTop: 2 }}>Compostos com alvo fixo de 6 repetições — você progride subindo a carga. Isolados seguem normais.</span>
                  </span>
                  <span style={{ width: 44, minWidth: 44, height: 26, borderRadius: 999, padding: 3, transition: 'background .25s ease', background: modoForca ? '#BDFF00' : 'rgba(234,229,219,.18)', display: 'flex', alignItems: 'center' }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: modoForca ? '#0D2818' : '#EAE5DB', transition: `transform .25s ${EASE}`, transform: modoForca ? 'translateX(18px)' : 'translateX(0)' }} />
                  </span>
                </div>
              </div>
            )}
            {/* 🔒 TÉCNICAS AVANÇADAS — opt-in ELEGÍVEL (Leva F, cofre §🥊, DF 2026-07-31).
                A entrada EXISTE e é visível mesmo para quem ainda não é elegível: a colisão
                declarada na spec é que "experiência demonstrada" exige histórico, e no dia 1
                o banco tem zero sessões — a feature seria invisível justamente para quem a
                pediu. 🔴 A linha do não-elegível descreve a REGRA DO APP, sem contador, sem
                denominador e sem contagem regressiva: "faltam N sessões" é alvo no futuro da
                atividade da pessoa (classes ① e ③ de vazamento). */}
            {experiencia !== 'iniciante' && !modoDiario && (
              <div style={{ marginTop: 14, background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.1)', borderRadius: 13, padding: '13px 16px' }}>
                <div onClick={() => tecnicasLiberadas && setTecnicas((v: boolean) => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: tecnicasLiberadas ? 'pointer' : 'default', opacity: tecnicasLiberadas ? 1 : .62 }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '.92rem', fontWeight: 500, color: 'rgba(234,229,219,.85)' }}>Técnicas avançadas</span>
                    {/* 🔒 "Opção de estilo, não upgrade": o benefício NÃO é superior
                        (meta-análise 2026), então a copy não pode vendê-las como melhores. */}
                    <span style={{ display: 'block', fontSize: '.78rem', color: 'rgba(234,229,219,.5)', lineHeight: 1.45, marginTop: 2 }}>Drop set, rest-pause, myo-reps e cluster na última série de exercícios isolados ou de máquina. É uma opção de estilo, não um upgrade — o app nunca adiciona sozinho.</span>
                    {!tecnicasLiberadas && (
                      <span style={{ display: 'block', fontSize: '.78rem', color: 'rgba(234,229,219,.4)', lineHeight: 1.45, marginTop: 6 }}>Fica disponível quando o app já tiver seu histórico de treinos.</span>
                    )}
                  </span>
                  <span style={{ width: 44, minWidth: 44, height: 26, borderRadius: 999, padding: 3, transition: 'background .25s ease', background: tecnicas ? '#BDFF00' : 'rgba(234,229,219,.18)', display: 'flex', alignItems: 'center' }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: tecnicas ? '#0D2818' : '#EAE5DB', transition: `transform .25s ${EASE}`, transform: tecnicas ? 'translateX(18px)' : 'translateX(0)' }} />
                  </span>
                </div>
              </div>
            )}
          </div>
          <div>
            <CardsBloco titulo="Local e equipamento" opts={LOCAIS} sel={local} onSel={setLocal} desc />
            {local === 'casa' && (
              <div style={{ marginTop: 14 }}>
                <ChecklistEquipamento selecionados={equipsCasa} onToggle={toggleEquip} onLimpar={() => setEquipsCasa([])} />
              </div>
            )}
          </div>

          <div>
            <div style={cap}>Dias de treino</div>
            <p style={{ margin: '0 0 2px', fontSize: '.85rem', color: 'rgba(234,229,219,.6)', lineHeight: 1.5 }}>Selecione os dias de treino. Os outros entram como descanso na sua semana.</p>
            <SeletorDias treinoDias={treinoDias} onToggle={toggleDia} contagemFont="1.5rem" stripMarginTop={14} />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 16, padding: '13px 15px', borderRadius: 12, background: 'rgba(189,255,0,.05)', border: '1px solid rgba(189,255,0,.2)' }}>
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M4 12a8 8 0 1 1 2.5 5.8" stroke="#BDFF00" strokeWidth={1.8} strokeLinecap="round" fill="none" /><path d="M4 18v-4.4h4.4" stroke="#BDFF00" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
              <p style={{ margin: 0, fontSize: '.87rem', color: 'rgba(234,229,219,.72)', lineHeight: 1.5 }}>Mudar seus dias de treino <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>reorganiza sua semana</strong> — as sessões são redistribuídas nos novos dias.</p>
            </div>
          </div>

          <div>
            <div style={cap}>Tempo por sessão</div>
            <div style={{ display: 'flex', gap: 7 }}>{[30, 45, 60, 75].map((t) => <div key={t} onClick={() => setTempo(t)} style={{ ...seg, ...(tempo === t ? segOn : {}) }}>{t === 75 ? '75+' : t}</div>)}</div>
          </div>

          <div>
            <div style={cap}>Padrão alimentar</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{PADROES.map((o) => <div key={o.id || 'oni'} onClick={() => setPadrao(o.id)} style={{ ...card, minWidth: 120, flex: 1, ...(padrao === o.id ? cardOn : {}) }}><div style={{ fontSize: '.98rem', fontWeight: 700 }}>{o.t}</div><div style={{ fontSize: '.82rem', color: 'rgba(234,229,219,.6)' }}>{o.d}</div></div>)}</div>
          </div>

          <PreferenciasAlimentares alergias={alergias} onToggleAlergia={toggleAlergia} naoCurto={naoCurto} onAddFood={addFood} onRemoveFood={removeFood} contexto="editar" />

          {/* Espelho POSITIVO do bloco acima (V8.2 — mesma família de preferências). */}
          <MeusFavoritos
            favoritos={favoritos}
            exercicioPorId={(id) => EXERCISES_SEED.find((e) => e.id === id)}
            elegibilidadeDe={(ex) => elegibilidadeFavorito(ex, { equipamento: local, nivelExperiencia: experiencia, equipamentosCasa: local === 'casa' ? equipsCasa : [] }, rotinaAtual, historicoRef)}
            onRemover={removerFavorito}
          />

          <ExerciciosBanidos
            banidos={banidos}
            exercicioPorId={(id) => EXERCISES_SEED.find((e) => e.id === id)}
            onRestaurar={(id) => setBanidos((p) => p.filter((x) => x !== id))}
          />

        </div>

        {!valido && <p style={{ color: '#E5484D', fontSize: '.88rem', margin: '14px 2px 0' }}>Confira idade (18–100), altura (100–250 cm) e peso (30–300 kg).</p>}

        <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
          <button onClick={onCancelar} className="evk-voltar" style={{ background: 'none', border: '1px solid rgba(234,229,219,.2)', color: 'rgba(234,229,219,.8)', fontWeight: 600, fontSize: '1rem', padding: '14px 24px', borderRadius: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={tentarSalvar} disabled={!valido} className={valido ? 'hov-btn' : ''} style={{ flex: 1, background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1.02rem', padding: 14, border: 'none', borderRadius: 13, cursor: valido ? 'pointer' : 'not-allowed', opacity: valido ? 1 : 0.4 }}>Salvar alterações</button>
        </div>
      </div>

      {/* TOAST · remover favorito é reversível (4,5 s; sair da tela = confirma). */}
      {removidoFav && <ToastDesfazer mensagem="Removido dos favoritos." onDesfazer={desfazerRemocao} onExpirar={() => setRemovidoFav(null)} />}

      {/* MODAL · RECALCULAR PLANO */}
      {confirmar && (
        <div onClick={() => setConfirmar(false)} style={{ position: 'fixed', inset: 0, zIndex: 213, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(7,18,11,.66)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 430, background: 'linear-gradient(168deg, rgba(16,42,26,.98), rgba(15,15,14,.98))', border: '1px solid rgba(189,255,0,.3)', borderRadius: 22, padding: 26, boxShadow: '0 40px 90px -30px rgba(0,0,0,.8)', animation: `evkPop .3s ${EASE}` }}>
            <div style={{ width: 48, height: 48, borderRadius: 13, background: 'rgba(189,255,0,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><svg width={24} height={24} viewBox="0 0 24 24" fill="none"><path d="M4 5v5h5M20 19v-5h-5" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><path d="M19 9a7.5 7.5 0 00-13-2.5L4 10M5 15a7.5 7.5 0 0013 2.5L20 14" stroke="#BDFF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg></div>
            <h2 style={{ margin: '0 0 10px', fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-.01em' }}>Recalcular seu plano?</h2>
            <p style={{ margin: '0 0 22px', fontSize: '.94rem', color: 'rgba(234,229,219,.72)', lineHeight: 1.6 }}>Mudar seus dias de treino <strong style={{ color: '#EAE5DB', fontWeight: 600 }}>reorganiza sua semana</strong> — as sessões serão redistribuídas nos novos dias. Suas preferências de alimentos não mudam.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={salvar} className="hov-btn" style={{ width: '100%', background: '#BDFF00', color: '#0D2818', fontWeight: 700, fontSize: '1rem', padding: 14, border: 'none', borderRadius: 13, cursor: 'pointer' }}>Confirmar e recalcular</button>
              <button onClick={() => setConfirmar(false)} className="evk-voltar" style={{ width: '100%', background: 'none', border: '1px solid rgba(234,229,219,.2)', color: '#EAE5DB', fontWeight: 600, fontSize: '1rem', padding: 14, borderRadius: 13, cursor: 'pointer' }}>Voltar e revisar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const cap: CSSProperties = { fontSize: '.8rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(234,229,219,.5)', marginBottom: 10 };
const seg: CSSProperties = { cursor: 'pointer', flex: 1, minWidth: 0, textAlign: 'center', padding: '13px 8px', borderRadius: 12, fontWeight: 600, fontSize: '.95rem', transition: 'all .25s ease', border: '1px solid rgba(234,229,219,.12)', background: 'rgba(234,229,219,.04)', color: 'rgba(234,229,219,.7)' };
const segOn: CSSProperties = { borderColor: '#BDFF00', background: 'rgba(189,255,0,.1)', color: '#BDFF00' };
const card: CSSProperties = { cursor: 'pointer', position: 'relative', background: 'rgba(234,229,219,.04)', border: '1px solid rgba(234,229,219,.12)', borderRadius: 16, padding: '16px 18px', transition: `all .25s ease` };
const cardOn: CSSProperties = { borderColor: '#BDFF00', background: 'rgba(189,255,0,.07)', boxShadow: '0 0 0 1px rgba(189,255,0,.35)' };

function CardsBloco<T extends string>({ titulo, opts, sel, onSel, desc }: { titulo: string; opts: { id: T; t: string; d: string }[]; sel: T; onSel: (v: T) => void; desc?: boolean }) {
  return (
    <div>
      <div style={cap}>{titulo}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: desc ? 9 : 10 }}>
        {opts.map((o) => {
          const on = sel === o.id;
          return (
            <div key={o.id} onClick={() => onSel(o.id)} style={{ ...card, ...(on ? cardOn : {}) }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div><div style={{ fontSize: '1rem', fontWeight: 700 }}>{o.t}</div>{desc && <div style={{ fontSize: '.86rem', color: 'rgba(234,229,219,.6)' }}>{o.d}</div>}</div>
                {on && <span style={{ width: 22, height: 22, minWidth: 22, borderRadius: '50%', background: '#BDFF00', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={12} height={12} viewBox="0 0 24 24"><path d="M5 12l5 5 9-11" stroke="#0D2818" strokeWidth={3.4} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Logo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      <line x1={28} y1={16} x2={28} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" /><line x1={29} y1={50} x2={68} y2={84} stroke="#EAE5DB" strokeWidth={13} strokeLinecap="round" />
      <path d="M33 50 Q50 38 70 18" stroke="#BDFF00" strokeWidth={3.5} fill="none" strokeLinecap="round" /><circle cx={35} cy={50} r={4.5} fill="#BDFF00" /><circle cx={52} cy={35} r={5} fill="#BDFF00" /><circle cx={70} cy={18} r={6} fill="#BDFF00" />
    </svg>
  );
}
