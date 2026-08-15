import { describe, expect, it } from 'vitest';
import { substituirExercicio, substituirPrato, listarSubstituicoesPrato, listarSubstituicoesExercicio } from './substituicao';
import { ESCALA_PORCAO } from './constants';
import { locaisPermitidos } from './treino-montador';
import { dificuldadesLiberadas } from './treino';
import { EQUIPAMENTOS_CASA } from './equipamento';
import type { EquipamentoCasa } from '../data/types';
import { gerarDieta } from './index';
import { macrosDePrato } from '../data/nutrition';
import { FOODS_BY_ID_SEED, RECIPES_SEED } from '../data/seed';
import { EXERCISES } from '../data/exercises';
import type { FlagsSaude, PerfilUsuario } from './types';
import type { PedidoSubPrato } from './substituicao-types';

const SEM: FlagsSaude = { gestacaoAmamentacao: false, renal: false, cardiaca: false, lesao: false, diabetes: false };

function perfil(over: Partial<PerfilUsuario> = {}): PerfilUsuario {
  return { sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30, nivelAtividade: 'moderado', objetivo: 'saude', flagsSaude: SEM, ...over };
}

/** Monta um cenário de dia real (plano + cardápio) e devolve o pedido p/ trocar o 1º prato. */
function cenario(over: Partial<PerfilUsuario> = {}, restr: PedidoSubPrato['restricoes'] = { alergenos: [], preferencia: null }) {
  const r = gerarDieta(perfil(over), { recipes: RECIPES_SEED, foodsById: FOODS_BY_ID_SEED, restricoes: restr });
  const item = r.cardapio!.itens[0]!;
  const pedido: PedidoSubPrato = {
    pratoAtual: item.prato,
    slot: item.refeicao,
    recipes: RECIPES_SEED,
    foodsById: FOODS_BY_ID_SEED,
    plano: r.plano!,
    totaisDiaAtual: r.cardapio!.totais,
    escalaAtual: item.escala,
    restricoes: restr,
  };
  return pedido;
}

describe('substituição de prato (F.2)', () => {
  it('nunca devolve prato com alérgeno do usuário', () => {
    const pedido = cenario({}, { alergenos: ['origem_animal'], preferencia: null });
    const r = substituirPrato(pedido);
    if (r.prato) expect(r.prato.contemAlergenos).not.toContain('origem_animal');
  });

  it('respeita identidade vegana (nunca relaxa)', () => {
    const pedido = cenario({}, { alergenos: [], preferencia: 'vegano' });
    const r = substituirPrato(pedido);
    if (r.prato) expect(r.prato.tipo).toBe('vegano');
    // mesmo no fallback (gosto relaxado), identidade não cede
    const r2 = substituirPrato({ ...pedido, gosto: { excluirPratoIds: RECIPES_SEED.map((x) => x.id) } });
    if (r2.prato) expect(r2.prato.tipo).toBe('vegano');
  });

  it('troca mantém o dia dentro da janela e ≥ piso de proteína; troca um prato diferente', () => {
    const pedido = cenario();
    const r = substituirPrato(pedido);
    if (r.status === 'ok') {
      expect(r.prato!.id).not.toBe(pedido.pratoAtual.id);
      expect(r.prato!.refeicoes).toContain(pedido.slot);
      expect(r.totaisDiaNovo!.kcal).toBeGreaterThanOrEqual(pedido.plano.janela.minKcal - 1e-6);
      expect(r.totaisDiaNovo!.kcal).toBeLessThanOrEqual(pedido.plano.janela.maxKcal + 1e-6);
      expect(r.totaisDiaNovo!.proteinaG).toBeGreaterThanOrEqual(pedido.plano.macros.proteinaPisoG - 1e-6);
    }
  });

  it('escala à equivalência calórica e ordena por menor desvio do prato trocado (escalado)', () => {
    const pedido = cenario();
    const r = substituirPrato(pedido);
    if (r.status === 'ok') {
      const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
      const escalaAtual = pedido.escalaAtual ?? 1;
      const xmBase = macrosDePrato(pedido.pratoAtual, FOODS_BY_ID_SEED);
      const xk = xmBase.kcal * escalaAtual; // kcal do prato trocado JÁ escalado
      // Equivalência calórica: o prato novo escalado fica ~na kcal do trocado (salvo clamp).
      const escolhidoDelta = Math.abs(r.macrosNovo!.kcal - xk);
      // nenhum outro elegível tem desvio (escalado) menor mantendo janela+piso
      for (const y of RECIPES_SEED) {
        if (y.id === pedido.pratoAtual.id || !y.refeicoes.includes(pedido.slot)) continue;
        if (y.contemAlergenos.some((a) => pedido.restricoes.alergenos.includes(a))) continue;
        const ymBase = macrosDePrato(y, FOODS_BY_ID_SEED);
        if (ymBase.kcal <= 0) continue;
        const s = clamp(xk / ymBase.kcal, ESCALA_PORCAO.min, ESCALA_PORCAO.max);
        const ymK = ymBase.kcal * s;
        const ymP = ymBase.proteinaG * s;
        const diaNew = pedido.totaisDiaAtual.kcal - xk + ymK;
        const protNew = pedido.totaisDiaAtual.proteinaG - xmBase.proteinaG * escalaAtual + ymP;
        const dentro = diaNew >= pedido.plano.janela.minKcal - 1e-6 && diaNew <= pedido.plano.janela.maxKcal + 1e-6 && protNew >= pedido.plano.macros.proteinaPisoG - 1e-6;
        if (dentro) expect(Math.abs(ymK - xk)).toBeGreaterThanOrEqual(escolhidoDelta - 1e-6);
      }
    }
  });

  it('gosto cede por último (fallback) — exclui o melhor e ainda acha troca', () => {
    const pedido = cenario();
    const primeiro = substituirPrato(pedido);
    if (primeiro.status === 'ok') {
      const r = substituirPrato({ ...pedido, gosto: { excluirPratoIds: [primeiro.prato!.id] } });
      if (r.status === 'ok') expect(r.prato!.id).not.toBe(primeiro.prato!.id);
    }
  });

  it('é determinístico', () => {
    const pedido = cenario();
    const a = substituirPrato(pedido);
    const b = substituirPrato(pedido);
    expect(a.prato?.id).toBe(b.prato?.id);
  });

  // Bloco B — escala de porções: o cardápio com porções fixas não alcançava a janela
  // (máx. 1680 < piso 1800 da janela; ver parametros-motor-dieta §"escalar pratos").
  // Com a escala, o dia mira a kcal-alvo e a troca volta a fechar.
  const femMod = { sexo: 'feminino' as const, pesoKg: 70, alturaCm: 170, idade: 30, nivelAtividade: 'moderado' as const, objetivo: 'emagrecimento' as const };

  it('montador ESCALA porções e alcança a janela (caso antes impossível)', () => {
    const r = gerarDieta(perfil(femMod), { recipes: RECIPES_SEED, foodsById: FOODS_BY_ID_SEED, restricoes: { alergenos: [], preferencia: null } });
    expect(r.cardapio!.status).toBe('ok');
    expect(r.cardapio!.totais.kcal).toBeGreaterThanOrEqual(r.plano!.janela.minKcal - 1e-6);
    expect(r.cardapio!.totais.kcal).toBeLessThanOrEqual(r.plano!.janela.maxKcal + 1e-6);
    for (const it of r.cardapio!.itens) {
      expect(it.escala).toBeGreaterThan(0);
      const base = macrosDePrato(it.prato, FOODS_BY_ID_SEED);
      expect(it.macros.kcal).toBeCloseTo(base.kcal * it.escala, 6); // macros = base × escala
    }
  });

  it('troca de prato AGORA fecha (status ok) e mantém o dia na janela', () => {
    const pedido = cenario(femMod);
    const r = substituirPrato(pedido);
    expect(r.status).toBe('ok');
    expect(r.prato!.id).not.toBe(pedido.pratoAtual.id);
    expect(r.totaisDiaNovo!.kcal).toBeGreaterThanOrEqual(pedido.plano.janela.minKcal - 1e-6);
    expect(r.totaisDiaNovo!.kcal).toBeLessThanOrEqual(pedido.plano.janela.maxKcal + 1e-6);
    expect(r.totaisDiaNovo!.proteinaG).toBeGreaterThanOrEqual(pedido.plano.macros.proteinaPisoG - 1e-6);
  });
});

describe('substituição de exercício (F.2)', () => {
  const supinoBarra = EXERCISES.find((e) => e.id === 'e9')!; // Supino reto, academia, empurrar
  const flexao = EXERCISES.find((e) => e.id === 'e1')!; // Flexão, casa_sem, empurrar, iniciante

  it('respeita equipamento/local, tipo e dificuldade ≤ liberada', () => {
    const r = substituirExercicio({ exercicioAtual: flexao, equipamento: 'nenhum', nivelExperiencia: 'iniciante', exercises: EXERCISES });
    if (r.exercicio) {
      expect(r.exercicio.local).toBe('casa_sem');
      expect(r.exercicio.nivel).toBe('iniciante');
      expect(r.exercicio.id).not.toBe(flexao.id);
    }
  });

  it('preserva grupo/padrão e prefere o mais familiar (tier menor)', () => {
    const r = substituirExercicio({ exercicioAtual: supinoBarra, equipamento: 'academia', nivelExperiencia: 'avancado', exercises: EXERCISES });
    expect(r.status).toBe('ok');
    // entre dois igualmente preservados, escolhe o de menor tier
    expect(r.exercicio).toBeTruthy();
  });

  it('skater (pliométrico, padrão cardio): intermediário → outro pliométrico; iniciante → cardio (cruza tipo no padrão)', () => {
    const skater = EXERCISES.find((e) => e.nomePt.toLowerCase().includes('patinador'))!;
    expect(skater.padraoMovimento).toBe('cardio');
    expect(skater.tipo).toBe('pliometrico');

    // intermediário: existe pliométrico elegível → mantém o tipo (pliométrico)
    const rI = substituirExercicio({ exercicioAtual: skater, equipamento: 'nenhum', nivelExperiencia: 'intermediario', exercises: EXERCISES });
    expect(rI.status).toBe('ok');
    expect(rI.exercicio!.tipo).toBe('pliometrico');
    expect(rI.exercicio!.local).toBe('casa_sem');

    // iniciante: sem pliométrico liberado → degrada para MESMO padrão (cardio), sem ficar sem opção
    const rIni = substituirExercicio({ exercicioAtual: skater, equipamento: 'nenhum', nivelExperiencia: 'iniciante', exercises: EXERCISES });
    expect(rIni.status).toBe('ok');
    expect(rIni.exercicio!.padraoMovimento).toBe('cardio');
    expect(rIni.exercicio!.nivel).toBe('iniciante');
    expect(rIni.exercicio!.id).not.toBe(skater.id);
  });

  it('gosto/variedade cedem por último (fallback)', () => {
    const r1 = substituirExercicio({ exercicioAtual: flexao, equipamento: 'casa', nivelExperiencia: 'intermediario', exercises: EXERCISES });
    if (r1.exercicio) {
      const r2 = substituirExercicio({ exercicioAtual: flexao, equipamento: 'casa', nivelExperiencia: 'intermediario', exercises: EXERCISES, gostoExcluirIds: [r1.exercicio.id] });
      if (r2.status === 'ok') expect(r2.exercicio!.id).not.toBe(r1.exercicio.id);
    }
  });

  it('é determinístico', () => {
    const args = { exercicioAtual: supinoBarra, equipamento: 'academia' as const, nivelExperiencia: 'avancado' as const, exercises: EXERCISES };
    expect(substituirExercicio(args).exercicio?.id).toBe(substituirExercicio(args).exercicio?.id);
  });

  it('nunca devolve o próprio exercício', () => {
    for (const equip of ['nenhum', 'casa', 'academia'] as const)
      for (const ex of [flexao, supinoBarra]) {
        const r = substituirExercicio({ exercicioAtual: ex, equipamento: equip, nivelExperiencia: 'avancado', exercises: EXERCISES });
        if (r.exercicio) expect(r.exercicio.id).not.toBe(ex.id);
      }
  });
});

/**
 * Regressão do seletor de troca (bug "3 opções iguais"): substituirPrato/Exercicio relaxam
 * o gosto/variedade no fallback e, chamados em laço, repetem. listarSubstituicoes* deduplica.
 */
describe('listarSubstituicoesPrato — lista sem duplicatas', () => {
  // Combinação restritiva (vegano) é a que mais força o fallback a repetir no motor antigo.
  const PERFIS: { o: Partial<PerfilUsuario>; r: PedidoSubPrato['restricoes'] }[] = [
    { o: {}, r: { alergenos: [], preferencia: null } },
    { o: { objetivo: 'massa' }, r: { alergenos: [], preferencia: 'vegetariano' } },
    { o: { sexo: 'feminino', pesoKg: 70, objetivo: 'saude' }, r: { alergenos: [], preferencia: 'vegano' } },
  ];

  it('nunca devolve o mesmo prato duas vezes (todas as opções distintas)', () => {
    for (const { o, r } of PERFIS) {
      const pedido = cenario(o, r);
      const lista = listarSubstituicoesPrato(pedido, 3);
      const ids = lista.map((x) => x.prato!.id);
      expect(new Set(ids).size).toBe(ids.length); // sem duplicatas
      expect(lista.length).toBeLessThanOrEqual(3);
      // nenhuma opção é o próprio prato trocado nem um id já excluído
      for (const x of lista) expect(x.prato!.id).not.toBe(pedido.pratoAtual.id);
    }
  });

  it('respeita excluirPratoIds (não repete os já mostrados) — fluxo "gerar mais"', () => {
    const pedido = cenario({}, { alergenos: [], preferencia: null });
    const lote1 = listarSubstituicoesPrato(pedido, 3).map((x) => x.prato!.id);
    const lote2 = listarSubstituicoesPrato({ ...pedido, gosto: { excluirPratoIds: lote1 } }, 3);
    for (const x of lote2) expect(lote1).not.toContain(x.prato!.id); // nada reaparece
  });

  it('para quando o pool elegível se esgota (não inventa repetição)', () => {
    // dieta vegana tem poucos cafés que cabem na janela → a lista vem curta, sem duplicar
    const pedido = cenario({ sexo: 'feminino', pesoKg: 70, objetivo: 'saude' }, { alergenos: [], preferencia: 'vegano' });
    const lista = listarSubstituicoesPrato(pedido, 3);
    const ids = lista.map((x) => x.prato!.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('é determinístico', () => {
    const pedido = cenario();
    const a = listarSubstituicoesPrato(pedido, 3).map((x) => x.prato!.id);
    const b = listarSubstituicoesPrato(pedido, 3).map((x) => x.prato!.id);
    expect(a).toEqual(b);
  });
});

describe('listarSubstituicoesExercicio — lista sem duplicatas', () => {
  const supino = EXERCISES.find((e) => e.id === 'e9')!; // Supino reto, academia, empurrar
  it('nunca repete exercício e respeita historicoRecenteIds', () => {
    const lista = listarSubstituicoesExercicio({ exercicioAtual: supino, equipamento: 'academia', nivelExperiencia: 'avancado', exercises: EXERCISES }, 3);
    const ids = lista.map((x) => x.exercicio!.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const x of lista) expect(x.exercicio!.id).not.toBe(supino.id);
    const lote2 = listarSubstituicoesExercicio({ exercicioAtual: supino, equipamento: 'academia', nivelExperiencia: 'avancado', exercises: EXERCISES, historicoRecenteIds: ids }, 3);
    for (const x of lote2) expect(ids).not.toContain(x.exercicio!.id);
  });
});

// ── Filtro DURO de preservação + famílias (DF 2026-07-04 — cofre substituicao §2/§Famílias) ──
describe('preservação como filtro duro + famílias (DF 2026-07-04)', () => {
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));

  it('C2: trocar e9 Supino (INT, academia) → família supino-horizontal PRIMEIRO (e11, e15), depois os demais', () => {
    // Antes da DF: e11 vinha 1º por acaso de string e e1 Flexão aparecia em 2º.
    // Com famílias: e11 (mesma família, mesma dificuldade) → e15 (mesma família, INI) →
    // e10/e12 (inclinado — OUTRA família, rank0 genérico) → e13.
    const lista = listarSubstituicoesExercicio(
      { exercicioAtual: byId.get('e9')!, equipamento: 'academia', nivelExperiencia: 'intermediario', exercises: EXERCISES }, 5,
    ).map((r) => r.exercicio!.id);
    expect(lista).toEqual(['e11', 'e15', 'e10', 'e12', 'e13']);
  });

  it('C4: trocar e116 Remada invertida em casa-sem → troca REAL, e ela é puxar', () => {
    // 🔒 2026-08-15 — o gap do conteúdo fechou. O comentário anterior previa: "os +puxar
    // casa-sem virão como ids 164+ (NUNCA renumerar)". Vieram: `e164`–`e168`. Até então a
    // UI sinalizava vazio honesto; agora entrega troca — e a REGRA de sempre, a que este
    // caso existe para proteger, é a mesma nos dois regimes: **preservação como filtro
    // duro**. Nunca devolver empurrar/agachar no lugar de um puxar (o mascaramento que a
    // DF 2026-07-04 matou).
    for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const) {
      const r = substituirExercicio({ exercicioAtual: byId.get('e116')!, equipamento: 'nenhum', nivelExperiencia: nivel, exercises: EXERCISES });
      expect(r.status, `nível ${nivel}`).toBe('ok');
      expect(r.exercicio, `nível ${nivel}: status ok com exercício nulo é vazio disfarçado`).not.toBeNull();
      expect(r.exercicio!.padraoMovimento, `nível ${nivel} devolveu ${r.exercicio!.id}`).toBe('puxar');
    }
    // E a lista inteira preserva o movimento — não só o primeiro colocado.
    const lista = listarSubstituicoesExercicio(
      { exercicioAtual: byId.get('e116')!, equipamento: 'nenhum', nivelExperiencia: 'iniciante', exercises: EXERCISES }, 3,
    );
    expect(lista.length, 'lista vazia depois do fechamento do furo').toBeGreaterThan(0);
    for (const s of lista) expect(s.exercicio!.padraoMovimento, s.exercicio!.id).toBe('puxar');
  });

  it('C1: trocar e1 Flexão (INI, casa-sem) → família flexao primeiro (e156, e157), depois e40', () => {
    const lista = listarSubstituicoesExercicio(
      { exercicioAtual: byId.get('e1')!, equipamento: 'nenhum', nivelExperiencia: 'iniciante', exercises: EXERCISES }, 3,
    ).map((r) => r.exercicio!.id);
    expect(lista).toEqual(['e156', 'e157', 'e40']);
  });

  it('refino skater intocado: e151 cruza tipo dentro do padrão Cardio (preserva padrão → passa o duro)', () => {
    const int = listarSubstituicoesExercicio(
      { exercicioAtual: byId.get('e151')!, equipamento: 'nenhum', nivelExperiencia: 'intermediario', exercises: EXERCISES }, 4,
    ).map((r) => r.exercicio!.id);
    expect(int).toEqual(['e143', 'e163']); // pliométricos (mesmo grupo pernas)
    const ini = substituirExercicio({ exercicioAtual: byId.get('e151')!, equipamento: 'nenhum', nivelExperiencia: 'iniciante', exercises: EXERCISES });
    expect(ini.status).toBe('ok'); // degrada p/ cardio do mesmo padrão — nunca vazio
    expect(ini.exercicio!.padraoMovimento).toBe('cardio');
  });

  it('varredura 168×3×3: ZERO vazios — o furo do e116 fechou', () => {
    // 🔒 Este teste fez exatamente o que prometia. O comentário anterior dizia: "quando o
    // conteúdo 164+ (puxar casa-sem) chegar, este teste quebra e força a revisão — o furo
    // deve SUMIR, não crescer". Em 2026-08-15 a leva `e164`–`e168` chegou, ele quebrou, e a
    // revisão mediu: sumiu. O assert continua duro, agora do lado de zero.
    const vazios: string[] = [];
    for (const e of EXERCISES)
      for (const nivel of ['iniciante', 'intermediario', 'avancado'] as const)
        for (const eq of ['nenhum', 'casa', 'academia'] as const) {
          if (!locaisPermitidos(eq).includes(e.local)) continue;
          const r = substituirExercicio({ exercicioAtual: e, equipamento: eq, nivelExperiencia: nivel, exercises: EXERCISES });
          if (r.status === 'sinalizado') vazios.push(`${e.id}·${nivel}·${eq}`);
        }
    expect(vazios, `vazio reaberto: ${vazios.join(', ')}`).toEqual([]);
  });
});

/**
 * 🔒 O RAMO DE DEGRADAÇÃO DO PLIOMÉTRICO É INALCANÇÁVEL **POR DADO** (Bloco 5, 2026-08-01).
 *
 * `substituicao.ts:199-205` — pliométrico sem pliométrico elegível → força do mesmo padrão
 * → último recurso, mesmo padrão de qualquer tipo. A spec o mantém **declarado**, não
 * removido, e é isto que este bloco existe para sustentar:
 *
 * 🔑 **Remove-se capacidade inalcançável por CÓDIGO; declara-se — com guard — capacidade
 * inalcançável por DADO.** O ramo não roda hoje porque o catálogo tem 3 pliométricos, todos
 * `intermediario`, todos disponíveis em qualquer local. Nenhuma linha impede que isso mude:
 * no dia em que o DADO mudar, o ramo passa a valer **sem aviso**.
 *
 * ⚠️ E o preço está MEDIDO, não suposto: um pliométrico `iniciante` no catálogo faz o
 * substituto virar **e23 Polichinelo — tipo `cardio`, `grupoPrimario` null**. Potência de
 * quadríceps trocada por cardio genérico sem grupo. Pelo outro caminho (e143/e163 marcados
 * só-academia), quem degrada é o **próprio e151 Patinador → e30 Burpee**, igualmente sem
 * grupo. Este guard transforma essa surpresa latente em falha de build.
 *
 * 🔻 ESCOPO, dito com precisão: "inalcançável" vale para **perfil CONSISTENTE** — o nível do
 * usuário libera o exercício que ele tem em mãos, que é o que o montador produz. A chamada
 * DESCASADA (`e151` + usuário `iniciante`) alcança o ramo hoje e está travada logo acima, em
 * "refino skater intocado": ali a degradação é comportamento declarado, não surpresa.
 */
describe('🔒 degradação do pliométrico: inalcançável por DADO, com guard (Bloco 5)', () => {
  type Catalogo = typeof EXERCISES;
  const NIVEIS = ['iniciante', 'intermediario', 'avancado'] as const;
  const COMBOS_CASA: (readonly EquipamentoCasa[] | undefined)[] = [
    undefined, [], ...EQUIPAMENTOS_CASA.map((e) => [e] as const), EQUIPAMENTOS_CASA,
  ];

  /**
   * 🔑 CRITÉRIO OBSERVÁVEL, não espelho da implementação: **substituto de pliométrico que
   * não é pliométrico** só pode ter vindo do ramo 199-205 — a linha 195 (`mesmo tipo`) é a
   * única outra porta de `tipoCompativel`, e ela nunca deixa passar outro tipo. Então a
   * lista abaixo vazia ⇔ o ramo não decidiu nada. Sem reimplementar `temMesmoTipo` aqui
   * (espelho deriva do original sem ninguém perceber).
   */
  const degradacoes = (cat: Catalogo): string[] => {
    const fora: string[] = [];
    for (const atual of cat.filter((e) => e.tipo === 'pliometrico')) {
      for (const nivel of NIVEIS) {
        if (!dificuldadesLiberadas(nivel).includes(atual.nivel)) continue; // perfil CONSISTENTE
        for (const eq of ['nenhum', 'casa', 'academia'] as const) {
          if (!locaisPermitidos(eq).includes(atual.local)) continue;
          for (const casa of eq === 'casa' ? COMBOS_CASA : [undefined]) {
            const r = substituirExercicio({ exercicioAtual: atual, equipamento: eq, equipamentosCasa: casa, nivelExperiencia: nivel, exercises: cat });
            if (r.status === 'ok' && r.exercicio && r.exercicio.tipo !== 'pliometrico')
              fora.push(`${atual.id}·${nivel}·${eq} → ${r.exercicio.id} ${r.exercicio.nomePt} (${r.exercicio.tipo}, grupo ${r.exercicio.grupoPrimario})`);
          }
        }
      }
    }
    return fora;
  };

  it('🔴 NENHUM pliométrico de nível INICIANTE no catálogo — se entrar um, o ramo acende', () => {
    const iniciantes = EXERCISES.filter((e) => e.tipo === 'pliometrico' && e.nivel === 'iniciante');
    expect(
      iniciantes.map((e) => `${e.id} ${e.nomePt}`),
      'entrou pliométrico iniciante: 199-205 passou a valer — reveja a degradação ANTES de publicar o conteúdo',
    ).toEqual([]);
    // ⚠️ Só `iniciante`. A 1ª escrita também travava a COMPOSIÇÃO (`todos intermediários`) e
    // acusava um pliométrico AVANÇADO — que é inofensivo: para o usuário avançado todos os
    // níveis estão liberados, então nunca falta pliométrico. Travar composição em vez de
    // critério é guard que reprova dado correto. Quem cobre os outros caminhos é a varredura.
  });

  it('critério derivado: com perfil consistente, substituto de pliométrico É pliométrico', () => {
    // Pega TAMBÉM o caminho do equipamento — o nível não é a única forma de o dado mudar.
    expect(degradacoes(EXERCISES)).toEqual([]);
  });

  it('e151 Patinador (caso-teste obrigatório): troca por pliométrico, quadríceps preservado', () => {
    const e151 = EXERCISES.find((e) => e.id === 'e151')!;
    // ⚠️ Perfil derivado do PRÓPRIO exercício, não fixado em 'intermediario': cravar o nível
    // aqui faz o teste cair quando o e151 for re-nivelado — mudança de dado legítima que não
    // tem nada a ver com a degradação que este bloco guarda.
    const r = substituirExercicio({ exercicioAtual: e151, equipamento: 'nenhum', nivelExperiencia: e151.nivel, exercises: EXERCISES });
    expect(r.status).toBe('ok');
    // ⚠️ A PROPRIEDADE, não a identidade: cravar `e143` transformava este teste num retrato
    // da ORDENAÇÃO entre pliométricos de mesmo rank — outra asserção, já travada em "refino
    // skater intocado". Aqui o que se guarda é que o estímulo não degrada.
    expect(r.exercicio!.tipo).toBe('pliometrico');
    expect(r.exercicio!.grupoPrimario).toBe('quadriceps'); // NÃO é o cardio sem grupo
  });

  it('anti-vacuidade A — um pliométrico INICIANTE acende o ramo: vira Polichinelo (cardio, sem grupo)', () => {
    const e151 = EXERCISES.find((e) => e.id === 'e151')!;
    const cat = [...EXERCISES, { ...e151, id: 'eZZZ', nomePt: 'Plio iniciante hipotético', nivel: 'iniciante' as const }];
    const achados = degradacoes(cat);
    expect(achados.length, 'o guard ficou cego para o pliométrico iniciante').toBeGreaterThan(0);
    expect(achados.every((l) => l.includes('e23 Polichinelo (cardio, grupo null)'))).toBe(true);
  });

  it('anti-vacuidade B — outro caminho do dado: e143/e163 só-academia degradam o próprio e151', () => {
    const cat = EXERCISES.map((e) => (e.id === 'e143' || e.id === 'e163' ? { ...e, local: 'academia' as const } : e));
    const achados = degradacoes(cat);
    expect(achados.length, 'o guard só olha nível — o caminho do equipamento passa') .toBeGreaterThan(0);
    expect(achados.some((l) => l.startsWith('e151·') && l.includes('(cardio, grupo null)'))).toBe(true);
  });
});
