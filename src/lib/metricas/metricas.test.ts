import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  CHAVES_PERMITIDAS, DENYLIST_SAUDE, DESCRICAO_PUBLICA, RETENCAO_EVENTOS_MESES, TIPOS_EVENTO,
  chaveProibida, montarPayload, normalizarChave,
} from './eventos';

/**
 * TELEMETRIA DE PRODUTO — Leva C2. Cofre: `conceitos/metricas-de-produto-adaptkorpus`.
 *
 * O app não media nada: o colapso do beta (zero treinos, zero pesos, zero refeições) só
 * apareceu quando o cofre foi ler o banco à mão. Estes guards existem para que instrumentar
 * não custe o que a instrumentação costuma custar — dado sensível vazando para telemetria e
 * métrica voltando como número na cara da pessoa.
 */

const fonte = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

function arquivos(dir = 'src'): string[] {
  const out: string[] = [];
  const anda = (d: string) => {
    for (const nome of readdirSync(d)) {
      const p = join(d, nome);
      if (statSync(p).isDirectory()) { anda(p); continue; }
      if (!/\.tsx?$/.test(p) || /\.test\.tsx?$/.test(p)) continue;
      out.push(p);
    }
  };
  anda(dir);
  return out;
}

describe('🔴 DENYLIST — nenhuma chave de saúde ou PII entra em payload', () => {
  /**
   * 🔒 O aceite 2 pede que a denylist **falhe o build**. `npm run build` roda depois do
   * `npm test` no gate da casa, e este teste é o que quebra a cadeia — payload proibido
   * derruba a suíte antes de qualquer artefato existir.
   */
  it('nenhum payload PERMITIDO contém chave da denylist', () => {
    const violacoes: string[] = [];
    for (const tipo of TIPOS_EVENTO) {
      for (const chave of CHAVES_PERMITIDAS[tipo]) {
        if (chaveProibida(chave)) violacoes.push(`${tipo}.${chave}`);
      }
    }
    expect(violacoes, `chave de saúde/PII no payload: ${violacoes.join(', ')}`).toEqual([]);
  });

  it('a denylist pega variações de grafia (o que uma lista literal deixaria passar)', () => {
    for (const k of ['peso', 'pesoKg', 'peso_kg', 'PESO-KG', 'Peso Kg']) {
      expect(chaveProibida(k), k).toBe(true);
    }
    for (const k of ['imc', 'IMC', 'condicao', 'condição', 'Condicao']) {
      expect(chaveProibida(k), k).toBe(true);
    }
  });

  it('e NÃO acusa chave legítima (não passa por vacuidade)', () => {
    for (const k of ['rota', 'sessao_id', 'semana_ciclo', 'minutos', 'modalidade', 'seguiu', 'de_id']) {
      expect(chaveProibida(k), k).toBe(false);
    }
  });

  it('`montarPayload` LANÇA se uma chave proibida chegar', () => {
    expect(() => montarPayload('app_aberto', { rota: '/app', pesoKg: 80 })).toThrow(/proibida/);
    expect(() => montarPayload('refeicao_marcada', { refeicao: 'almoco', seguiu: true, prato: 'arroz' })).toThrow(/proibida/);
  });

  it('`montarPayload` PODA o que não é do evento (payload é fechado, não "pelo menos")', () => {
    expect(montarPayload('app_aberto', { rota: '/app', extra: 1, outro: 'x' })).toEqual({ rota: '/app' });
    expect(montarPayload('refeicao_marcada', { refeicao: 'jantar', seguiu: false })).toEqual({ refeicao: 'jantar', seguiu: false });
  });

  it('normalizarChave é o que torna a comparação robusta', () => {
    expect(normalizarChave('Peso_Kg')).toBe('pesokg');
    expect(normalizarChave('condição')).toBe('condicao');
    expect(DENYLIST_SAUDE.length).toBeGreaterThan(20);
  });
});

describe('🔒 os eventos declarados, e só eles', () => {
  it('a lista é exatamente a das specs (7 da Leva C2 + 5 do v3 + 1 da leva H + 3 do editor)', () => {
    expect([...TIPOS_EVENTO].sort()).toEqual([
      'app_aberto', 'aviso_risco_mostrado', 'cardio_registrado', 'editor_aberto',
      'exercicio_substituido',
      'foco_ativado', 'foco_encerrado', 'orcamento_escolhido', 'plano_gerado',
      'preferencia_criada', 'preferencia_recusada',
      'refeicao_marcada', 'sessao_concluida', 'sessao_iniciada',
      'tecnica_ativada', 'tecnica_elegivel', 'tecnica_feedback', 'treino_custom_salvo',
    ]);
  });

  /**
   * 🧭 EDITOR GUIADO (2026-08-13): o par uso × EVENTO ADVERSO desta leva. A DF① decidiu que
   * o aviso NÃO trava — `aviso_risco_mostrado` + `avisos_ativos` no salvamento são o que
   * transforma essa decisão em evidência (quantos veem o risco, quantos salvam mesmo assim).
   */
  it('editor: mede quem CHEGA, quem SALVA e o risco que apareceu', () => {
    expect(CHAVES_PERMITIDAS.editor_aberto).toEqual(['origem']);
    expect(CHAVES_PERMITIDAS.treino_custom_salvo).toEqual(['dias', 'exercicios', 'avisos_ativos']);
    expect(CHAVES_PERMITIDAS.aviso_risco_mostrado).toEqual(['codigo', 'contexto']);
  });

  it('v3 · Bloco A: o par uso × EVENTO ADVERSO — medir só o caminho feliz não mede nada', () => {
    // A recusa é o que diz se os trilhos estão no lugar ou atrapalhando; sem ela, o default
    // declarado nunca vira evidência (§16 da pesquisa).
    expect(TIPOS_EVENTO).toContain('preferencia_criada');
    expect(TIPOS_EVENTO).toContain('preferencia_recusada');
    expect(CHAVES_PERMITIDAS.preferencia_criada).toEqual(['tipo', 'de_id', 'para_id']);
    expect(CHAVES_PERMITIDAS.preferencia_recusada).toEqual(['tipo', 'motivo', 'de_id', 'para_id']);
  });

  it('v3 · Bloco B: o foco mede USO e DURAÇÃO — e o que ele de fato entregou', () => {
    // 🔑 `entrega` diz se o teto duro (MRV) morde na população real ou só na teoria.
    expect(CHAVES_PERMITIDAS.foco_ativado).toEqual(['grupo', 'compensa', 'entrega', 'delta']);
    // Sem o encerramento não se mede duração, e a janela de 4–6 semanas nunca vira evidência.
    expect(CHAVES_PERMITIDAS.foco_encerrado).toEqual(['grupo', 'semanas', 'motivo']);
  });

  it('v3 · Bloco C: o portão medido, o uso medido — e o custo em esforço', () => {
    // `tecnica_elegivel` é o DENOMINADOR: sem ele, "poucos usam" não distingue "poucos
    // querem" de "poucos podem".
    expect(CHAVES_PERMITIDAS.tecnica_elegivel).toEqual(['sessoes', 'nivel']);
    expect(CHAVES_PERMITIDAS.tecnica_ativada).toEqual(['tecnica', 'exercicio_id']);
    // 🔑 O evento adverso: reabertas por reconhecimento, não por eficácia — o que se vigia é
    // o custo em esforço percebido.
    expect(CHAVES_PERMITIDAS.tecnica_feedback).toEqual(['tecnica', 'esforco']);
  });

  it('todo tipo tem payload declarado, e o payload da spec bate', () => {
    expect(Object.keys(CHAVES_PERMITIDAS).sort()).toEqual([...TIPOS_EVENTO].sort());
    expect(CHAVES_PERMITIDAS.app_aberto).toEqual(['rota']);
    expect(CHAVES_PERMITIDAS.plano_gerado).toEqual(['plano_id', 'objetivo', 'nivel', 'local', 'dias_declarados']);
    expect(CHAVES_PERMITIDAS.sessao_iniciada).toEqual(['sessao_id', 'data_agendada', 'semana_ciclo']);
    expect(CHAVES_PERMITIDAS.sessao_concluida).toEqual(['sessao_id', 'duracao_real_min', 'exercicios_feitos', 'exercicios_planejados']);
    expect(CHAVES_PERMITIDAS.exercicio_substituido).toEqual(['de_id', 'para_id', 'motivo']);
    expect(CHAVES_PERMITIDAS.refeicao_marcada).toEqual(['refeicao', 'seguiu']);
    expect(CHAVES_PERMITIDAS.cardio_registrado).toEqual(['modalidade', 'minutos', 'origem']);
  });

  /** 🔒 Abandono e denominador são DERIVADOS — não podem virar evento. */
  it('não existe evento de abandono nem de denominador', () => {
    for (const proibido of ['abandono', 'abandonado', 'denominador', 'aderencia', 'sessoes_agendadas']) {
      expect((TIPOS_EVENTO as readonly string[]).includes(proibido), proibido).toBe(false);
    }
  });
});

describe('🔑 CALL SITES — cada evento sai do ato que ele mede', () => {
  /**
   * O critério de aceite nº 1 é explícito: *"não basta a função de log existir; o teste
   * prova que `sessao_iniciada` sai QUANDO a sessão inicia"*. É a mesma regra que a Leva A
   * transformou em varredura — a suíte prova função, não montagem.
   */
  const painel = fonte(join('src', 'components', 'painel', 'Painel.tsx'));
  const onboarding = fonte(join('src', 'app', 'onboarding', 'page.tsx'));
  const refeicao = fonte(join('src', 'components', 'painel', 'RegistroRefeicao.tsx'));

  /** Corpo de função nomeada — fecha os PARÊNTESES antes de procurar o `{`. */
  function corpoDe(src: string, nome: string): string {
    const i = src.search(new RegExp(`function\\s+${nome}\\s*\\(`));
    if (i < 0) return '';
    const abreP = src.indexOf('(', i);
    let p = 0; let fimP = -1;
    for (let j = abreP; j < src.length; j += 1) {
      if (src[j] === '(') p += 1;
      else if (src[j] === ')') { p -= 1; if (p === 0) { fimP = j; break; } }
    }
    if (fimP < 0) return '';
    const abre = src.indexOf('{', fimP);
    let n = 0;
    for (let j = abre; j < src.length; j += 1) {
      if (src[j] === '{') n += 1;
      else if (src[j] === '}') { n -= 1; if (n === 0) return src.slice(abre, j + 1); }
    }
    return '';
  }

  it('o extrator de corpo funciona (anti-vacuidade)', () => {
    expect(corpoDe(painel, 'concluirSessao')).toContain('registrarSessao');
    expect(corpoDe(painel, 'funcao_inexistente')).toBe('');
  });

  it('`sessao_iniciada` sai de quem INICIA a sessão guiada', () => {
    const c = corpoDe(painel, 'iniciarSessaoGuiada');
    expect(c, 'iniciarSessaoGuiada sumiu').not.toBe('');
    expect(c).toMatch(/registrarEvento\('sessao_iniciada'/);
    expect(c).toMatch(/setSessaoDia\(idx\)/);
  });

  /** E ninguém pode abrir a sessão pulando o registro. */
  it('nenhum call site abre a sessão com `setSessaoDia` cru', () => {
    const crus = [...painel.matchAll(/setSessaoDia\((\d+|d|idx)\)/g)].map((m) => m[0]);
    // O único permitido é o de DENTRO de `iniciarSessaoGuiada`.
    expect(crus.length, `aberturas cruas: ${crus.join(', ')}`).toBe(1);
  });

  it('`sessao_concluida` sai de quem CONCLUI', () => {
    expect(corpoDe(painel, 'concluirSessao')).toMatch(/registrarEvento\('sessao_concluida'/);
  });

  it('`cardio_registrado` sai de quem salva o cardio', () => {
    expect(corpoDe(painel, 'salvarCardio')).toMatch(/registrarEvento\('cardio_registrado'/);
  });

  it('`exercicio_substituido` sai de quem aplica a troca', () => {
    expect(corpoDe(painel, 'aplicarEx')).toMatch(/registrarEvento\('exercicio_substituido'/);
  });

  it("`app_aberto` sai quando o painel monta de verdade", () => {
    const hook=fonte(join('src','lib','persistencia','use-conta-sync.ts'));
    expect(hook).toContain("registrarEvento('app_aberto', { rota: '/app' })");
    expect(hook.indexOf('setVisivel(mostra);')).toBeLessThan(hook.indexOf("registrarEvento('app_aberto'"));
    expect(hook.indexOf('if (!remoto)')).toBeLessThan(hook.indexOf("registrarEvento('app_aberto'"));
  });

  it('`plano_gerado` sai junto do plano, no onboarding', () => {
    expect(onboarding).toMatch(/registrarEvento\('plano_gerado'[\s\S]{0,400}salvarSessao\(resumo, entradaCorrigida\);/);
  });

  it('`refeicao_marcada` sai no ato da marcação', () => {
    expect(refeicao).toMatch(/registrarEvento\('refeicao_marcada'/);
    expect(refeicao).toMatch(/setStatus:[\s\S]{0,220}registrarEvento\('refeicao_marcada'/);
  });

  it('os 7 têm pelo menos um call site em src/', () => {
    const todo = arquivos().map(fonte).join('\n');
    for (const t of TIPOS_EVENTO) {
      expect(todo, `${t} sem call site`).toMatch(new RegExp(`registrarEvento\\('${t}'`));
    }
  });
});

describe('🔒 primeira parte — nada de terceiro, e nada fora de `eventos`', () => {
  it('o único caminho de escrita é `/api/metricas`', () => {
    expect(fonte(join('src', 'lib', 'metricas', 'registrar.ts'))).toMatch(/fetch\('\/api\/metricas'/);
  });

  it('a rota grava em `eventos`, NUNCA em `logs`', () => {
    const rota = fonte(join('src', 'app', 'api', 'metricas', 'route.ts'));
    expect(rota).toMatch(/from\('eventos'\)\.insert/);
    expect(/from\('logs'\)/.test(rota), 'telemetria escrevendo em logs — corromperia o histórico').toBe(false);
  });

  /** 🔴 A denylist vale NO SERVIDOR também: o cliente é código que o usuário controla. */
  it('a rota aplica a denylist no servidor', () => {
    expect(fonte(join('src', 'app', 'api', 'metricas', 'route.ts'))).toMatch(/chaveProibida\(k\)/);
  });

  it('nenhum endpoint de terceiro recebe comportamento', () => {
    // ⚠️ `amplitude` SEM âncora casava com "amplitude de movimento" nos textos de exercício
    // — 2 falsos positivos. Os nomes de produto só contam como ENDEREÇO (host/import).
    const suspeitos = /(googletagmanager\.com|google-analytics\.com|segment\.(io|com)|api\.mixpanel\.com|api\.amplitude\.com|posthog\.com|hotjar\.com|sentry\.io\/api|from '(@segment|mixpanel|amplitude|posthog|@sentry))/i;
    const culpados = arquivos().filter((f) => suspeitos.test(fonte(f)));
    expect(culpados, `telemetria para terceiro: ${culpados.join(', ')}`).toEqual([]);
  });
});

describe('🔒 a migration `0009` cria a tabela certa', () => {
  const sql = readFileSync(join('supabase', 'migrations', '0009_eventos_telemetria.sql'), 'utf8');
  /**
   * ⚠️ O CHECK do banco evolui por migration NOVA (0010 acrescentou os dois do v3), então
   * procurar o tipo só na 0009 quebraria a cada evento — e a tentação seria afrouxar o
   * guard. O critério certo é o EFEITO: o tipo tem de estar no CHECK **vigente**, isto é, na
   * migration mais recente que o define. Varre-se a pasta inteira.
   *
   * 🔴 Por que isto é guard e não conforto: o `tipo` fora do CHECK é rejeitado pelo BANCO, e
   * `registrarEvento` engole todo erro por decisão — o app pareceria medir sem medir.
   */
  const migrations = readdirSync(join('supabase', 'migrations'))
    .filter((f) => f.endsWith('.sql')).sort()
    .map((f) => readFileSync(join('supabase', 'migrations', f), 'utf8'));

  it('cria `eventos` com cascade, e todo tipo declarado está no CHECK vigente', () => {
    expect(sql).toMatch(/create table if not exists public\.eventos/);
    expect(sql).toMatch(/references auth\.users\(id\) on delete cascade/);
    for (const t of TIPOS_EVENTO)
      expect(migrations.some((m) => m.includes(`'${t}'`)), `nenhuma migration põe ${t} no CHECK — o banco rejeitaria em silêncio`).toBe(true);
  });

  it('anti-vacuidade: a varredura lê migrations de verdade e um tipo inventado NÃO passa', () => {
    expect(migrations.length).toBeGreaterThanOrEqual(10);
    expect(migrations.some((m) => m.includes(`'evento_que_nunca_existiu'`))).toBe(false);
  });

  it('tem RLS e é append-only (sem update, sem delete pelo cliente)', () => {
    expect(sql).toMatch(/alter table public\.eventos enable row level security/);
    expect(sql).toMatch(/eventos_select_own/);
    expect(sql).toMatch(/eventos_insert_own/);
    expect(/eventos_update_own|eventos_delete_own/.test(sql), 'telemetria não é editável pelo cliente').toBe(false);
  });

  /** 🔴 `logs` fica INTOCADO — é o histórico da pessoa, fechado em 3 tipos. */
  it('NÃO toca `logs` nem amplia o CHECK dele', () => {
    expect(/alter table public\.logs|public\.logs/.test(sql), '0009 mexendo em logs').toBe(false);
    const init = readFileSync(join('supabase', 'migrations', '0001_init.sql'), 'utf8');
    expect(init).toMatch(/tipo\s+text not null check \(tipo in \('treino','refeicao','peso'\)\)/);
  });
});

describe('🔒 export e exclusão — o que a LGPD promete', () => {
  const exportar = fonte(join('src', 'app', 'api', 'lgpd', 'exportar', 'route.ts'));

  it("o export traz `eventos` como seção própria", () => {
    expect(exportar).toContain("lerColecaoCompleta(ctx,'eventos',limite)");
    expect(exportar).toContain("lerColecaoCompleta(ctx,'logs',limite)");
    expect(exportar).toContain('Promise.allSettled');expect(exportar).toContain('if (falharam.length) return');
    expect(exportar).toContain('Object.fromEntries(resultados.map');
  });

  /**
   * 🔒 TESTE OBRIGATÓRIO (aceite 3): conta excluída não deixa linha em `logs` NEM em
   * `eventos`. A garantia é do BANCO — `on delete cascade` no FK — e não de código que
   * alguém precise lembrar de escrever. Prova-se lendo o schema das duas tabelas.
   */
  it('conta excluída não deixa linha em `logs` nem em `eventos` (cascade no schema)', () => {
    const init = readFileSync(join('supabase', 'migrations', '0001_init.sql'), 'utf8');
    const ev = readFileSync(join('supabase', 'migrations', '0009_eventos_telemetria.sql'), 'utf8');
    const cascade = /user_id\s+uuid not null references auth\.users\(id\) on delete cascade/;
    // `logs` (histórico)
    const blocoLogs = init.slice(init.indexOf('create table if not exists public.logs'));
    expect(cascade.test(blocoLogs.slice(0, 400)), 'logs sem cascade').toBe(true);
    // `eventos` (telemetria)
    expect(cascade.test(ev), 'eventos sem cascade').toBe(true);
    // E a exclusão realmente apaga o usuário (é o que dispara a cascata).
    expect(fonte(join('src', 'app', 'api', 'lgpd', 'excluir', 'route.ts'))).toMatch(/auth\.admin\.deleteUser\(ctx\.user\.id\)/);
  });
});

describe('🔒 retenção — os dois prazos, com precisão', () => {
  const priv = fonte(join('src', 'app', 'privacidade', 'page.tsx'));

  it('telemetria = 12 meses, e a constante bate com a página', () => {
    expect(RETENCAO_EVENTOS_MESES).toBe(12);
    expect(priv).toMatch(/12 meses/);
    expect(priv).toMatch(/apagados/);
  });

  /**
   * 🔴 O erro que isto impede: aplicar "12 meses" ao histórico deletaria pesos, treinos e
   * refeições de qualquer conta com mais de um ano — perda do dado que o app existe para
   * guardar. A página tem de dizer os DOIS prazos.
   */
  it('histórico = enquanto a conta existir (a página diz os dois)', () => {
    expect(priv).toMatch(/enquanto a conta existir/);
    expect(priv).toMatch(/histórico/i);
  });

  /**
   * ⚠️ A 1ª versão pedia só `/eventos de uso/i` — e a frase aparece em DOIS parágrafos (a
   * descrição e a retenção). Apagar a DESCRIÇÃO inteira ainda casava pelo parágrafo da
   * retenção: o guard provava que o assunto existe, nunca que a página o DESCREVE.
   */
  /**
   * ⚠️ ACHADO DE 2026-08-06, e o conserto de CLASSE. Este guard era uma LISTA LITERAL dos 7
   * atos da Leva C2 — por isso não acusou quando o v3 acrescentou 5 eventos sem tocar a
   * página, que ficou defasada por três levas. Atualizar a lista para a contagem nova apenas
   * re-armaria a doença; a lista própria era uma TERCEIRA cópia da verdade.
   *
   * Agora a enumeração DERIVA do registro canônico (`TIPOS_EVENTO` → `DESCRICAO_PUBLICA`, a
   * mesma fonte que o CHECK do banco espelha). Evento novo sem descrição não compila; evento
   * descrito sem estar na página cai aqui.
   */
  it('a `/privacidade` descreve os eventos, um a um (derivado do registro canônico)', () => {
    const faltando = TIPOS_EVENTO
      .filter((t) => !new RegExp(DESCRICAO_PUBLICA[t], 'i').test(priv))
      .map((t) => `${t} → "${DESCRICAO_PUBLICA[t]}"`);
    expect(faltando, `a /privacidade não descreve:\n${faltando.join('\n')}`).toEqual([]);
  });

  it('toda descrição pública pertence a um evento que existe (sem cópia órfã)', () => {
    expect(Object.keys(DESCRICAO_PUBLICA).sort()).toEqual([...TIPOS_EVENTO].sort());
  });

  it('a página mantém as promessas de tratamento', () => {
    expect(priv).toMatch(/nunca são enviados a terceiros/i);
    expect(priv).toMatch(/Nada de saúde entra nesses registros/i);
    expect(priv).toMatch(/saem no seu export e na exclusão de conta/i);
  });
});

describe('🔒 MEDIR NÃO É EXIBIR — nenhuma métrica na UI', () => {
  /**
   * Aceite 4. Vale "ausência não fala": o app não diz *"você abriu 3 vezes"* nem
   * *"sua aderência é 40%"*. Medir serve ao autor decidir; devolver como número na cara da
   * pessoa é outro produto — e um que o cofre recusou.
   */
  const PROIBIDO: readonly [RegExp, string][] = [
    [/sua ader[êe]ncia (é|de)\s*\d/i, 'percentual de aderência na tela'],
    [/você abriu( o app)? \d/i, 'contagem de aberturas'],
    [/dias sem treinar/i, '"dias sem treinar"'],
    [/taxa de (ades[ãa]o|conclus[ãa]o)/i, 'taxa exibida'],
    [/\d+%\s*de ader[êe]ncia/i, 'percentual de aderência'],
  ];

  const telas = arquivos('src/components').concat(arquivos('src/app'));

  it.each(PROIBIDO)('nenhuma tela mostra %s (%s)', (re, _porque) => {
    const culpados = telas.filter((f) => re.test(fonte(f)));
    expect(culpados, `métrica na UI em: ${culpados.join(', ')}`).toEqual([]);
  });

  it('nenhuma tela LÊ a tabela de eventos', () => {
    // A rota de escrita e o export LGPD são os ÚNICOS lugares legítimos — não são tela.
    const escritores = [join('api', 'metricas'), join('api', 'lgpd')];
    const culpados = telas.filter((f) => /from\('eventos'\)/.test(fonte(f)) && !escritores.some((e) => f.includes(e)));
    expect(culpados, `UI lendo telemetria: ${culpados.join(', ')}`).toEqual([]);
  });

  it('e a varredura enxerga arquivos de verdade (anti-vacuidade)', () => {
    expect(telas.length).toBeGreaterThan(30);
    expect(telas).toContain(join('src', 'components', 'painel', 'Painel.tsx'));
  });
});
