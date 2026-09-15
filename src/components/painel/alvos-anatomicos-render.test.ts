/**
 * 🦴 A RENDERIZAÇÃO NÃO CONFUNDE INFERÊNCIA COM MEDIÇÃO.
 *
 * O risco desta integração não é o motor escolher errado — é a tela transformar "a ação deste
 * exercício aborda esta cabeça" em "este exercício faz esta cabeça crescer". Uma lista de
 * músculos sem a qualificação ao lado lê-se exatamente assim.
 *
 * Guard estático (o padrão da casa para componentes) + contrato da rota. O que se cobra:
 *  1. a palavra **inferência** acompanha a lista de alvos diretos, e a definição do pacote
 *    (que diz que alvo direto NÃO é predominância medida) aparece ANTES dela;
 *  2. auxiliar, cardio e condicional pendente têm blocos próprios, com o que cada um não é;
 *  3. a tela não mostra número nenhum de ativação, percentual, ranking ou "melhor exercício";
 *  4. descritor aparece dito como descritor, e a comparação contextual carrega o protocolo e
 *    o limite — não vira "o supino inclinado é melhor para a parte superior";
 *  5. a rota devolve `base: 'inferencia_anatomica'` em todo alvo e nenhum campo numérico.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/catalogo/alvos-anatomicos/route';
import { ANATOMIA_POR_EXERCICIO } from '@/lib/data/alvos-anatomicos';

const COMPONENTE = 'src/components/painel/AlvosAnatomicos.tsx';
const fonte = readFileSync(COMPONENTE, 'utf8');
/** Sem comentários: o que se cobra é o que a pessoa LÊ, não a documentação do arquivo. */
const semComentarios = fonte
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

const rota = async (url: string) => {
  const r = GET(new Request(url));
  return { status: r.status, corpo: await r.json() as Record<string, unknown> };
};

describe('① a qualificação vem junto do alvo, nunca depois', () => {
  it('a lista de alvos diretos é rotulada como inferência anatômica', () => {
    expect(semComentarios).toMatch(/Aborda diretamente · por inferência anatômica/);
  });

  it('a definição do pacote (alvo direto ≠ predominância medida) é renderizada antes da lista', () => {
    const iDefinicao = semComentarios.indexOf('definicaoDeAlvoDireto');
    const iLista = semComentarios.indexOf('Aborda diretamente');
    expect(iDefinicao, 'a definição não é renderizada').toBeGreaterThan(-1);
    expect(iDefinicao, 'a definição aparece depois da lista de alvos').toBeLessThan(iLista);
  });

  it('a ressalva de cobertura é renderizada — não é opcional', () => {
    expect(semComentarios).toMatch(/\{d\.ressalva\}/);
  });
});

describe('② cada papel aparece com o que ele NÃO é', () => {
  it('auxiliar é dito como auxiliar e não fecha cobertura', () => {
    expect(semComentarios).toMatch(/Participa como auxiliar/);
    expect(semComentarios).toMatch(/não conta como alvo abordado/);
    expect(semComentarios).toMatch(/crédito\s*\n?\s*parcial de volume/);
  });

  it('cardio é dito informativo e não série de hipertrofia', () => {
    expect(semComentarios).toMatch(/informativa e não é série de hipertrofia/);
  });

  it('condicional pendente é dito em aberto — nem abordado, nem ausente', () => {
    expect(semComentarios).toMatch(/Depende de como você executa/);
    expect(semComentarios).toMatch(/não é dado como abordado nem como ausente/);
  });
});

describe('③ a tela não mostra número de ativação, ranking nem promessa', () => {
  it('nenhum percentual, "mais ativa", "melhor para" ou "ideal para" no texto visível', () => {
    const proibidos = [
      /\d+\s*%/, /mais ativ/i, /maior ativa/i, /melhor (para|exercício)/i, /ideal para/i,
      /garante/i, /mais eficaz/i, /ranking/i, /pontuaç/i, /\bscore\b/i,
    ];
    for (const p of proibidos) expect(semComentarios, `${p} aparece na tela`).not.toMatch(p);
  });

  it('não existe campo de ativação/hipertrofia no tipo da resposta', () => {
    // O texto visível pode DIZER "não é série de hipertrofia" — o que não pode existir é um
    // CAMPO com esse nome, que seria o coeficiente entrando pela porta dos bastidores.
    expect(semComentarios).not.toMatch(/\b(ativacao|ativação|hipertrofia|peso|intensidade|score)[A-Za-z]*\s*[:?]/i);
  });
});

describe('④ descritor é dito descritor, e a comparação carrega o limite', () => {
  it('descritores mecânicos vêm com a frase que os separa de eficiência', () => {
    expect(semComentarios).toMatch(/Descritores mecânicos/);
    expect(semComentarios).toMatch(/Não são medida de eficiência nem de crescimento/);
  });

  it('a comparação contextual mostra protocolo e limites, e nunca o converte em preferência', () => {
    expect(semComentarios).toMatch(/Comparação contextual/);
    expect(semComentarios).toMatch(/Protocolo:/);
    expect(semComentarios).toMatch(/Limites: \{e\.limite\}/);
    expect(semComentarios).not.toMatch(/usarComoPesoAutomatico\s*&&/);
  });
});

describe('⑤ o bloco entra AO LADO do "como fazer", nas duas portas', () => {
  it('detalhe de exercício e seletor renderizam o componente', () => {
    for (const f of ['src/components/painel/DetalheModais.tsx', 'src/components/painel/SeletorExercicio.tsx']) {
      expect(readFileSync(f, 'utf8'), f).toMatch(/<AlvosAnatomicos id=\{ex\.id\} nomePt=\{ex\.nomePt\} \/>/);
    }
  });

  it('o "como fazer" continua lá — o bloco somou, não substituiu', () => {
    expect(readFileSync('src/components/painel/DetalheModais.tsx', 'utf8')).toMatch(/\{ex\.comoFazer\}/);
    expect(readFileSync('src/components/painel/SeletorExercicio.tsx', 'utf8')).toMatch(/\{ex\.comoFazer \|\|/);
  });
});

describe('⑥ a rota devolve dado qualificado, e não coeficiente', () => {
  it('todo alvo carrega `base: inferencia_anatomica`, e a definição e a ressalva vêm juntas', async () => {
    const { corpo } = await rota('http://t/api/catalogo/alvos-anatomicos?id=e9');
    expect(corpo.classificado).toBe(true);
    for (const a of corpo.alvos as { base: string; ficha: { nome: string } }[]) {
      expect(a.base).toBe('inferencia_anatomica');
      expect(a.ficha.nome).toBeTruthy();
    }
    expect(String(corpo.definicaoDeAlvoDireto)).toMatch(/não predominância medida/);
    expect(String(corpo.ressalva)).toMatch(/não comprova dose suficiente/);
  });

  it('a resposta não tem número nenhum além do protocolo citado da fonte', async () => {
    for (const id of ['e9', 'e68', 'e104', 'e139', 'e23']) {
      const { corpo } = await rota(`http://t/api/catalogo/alvos-anatomicos?id=${id}`);
      // O único bloco com números é `enfasesContextuais[].protocolo` (ângulo e %1RM do estudo).
      const semEnfase = { ...corpo, enfasesContextuais: undefined };
      const numeros = JSON.stringify(semEnfase).match(/:\s*-?\d+(\.\d+)?/g) ?? [];
      expect(numeros, `${id}: número fora do protocolo citado`).toEqual([]);
    }
  });

  it('e104 sai com zero alvos diretos e a condição em aberto — a rota não presume execução', async () => {
    const { corpo } = await rota('http://t/api/catalogo/alvos-anatomicos?id=e104');
    expect((corpo.alvos as unknown[]).length).toBe(0);
    expect((corpo.condicionaisNaoResolvidas as { quando: unknown }[]).map((c) => c.quando))
      .toContainEqual({ movimento: 'extensao_coluna' });
  });

  it('id fora do mapa dá 404 dizendo que isso não afirma nada sobre o exercício', async () => {
    const { status, corpo } = await rota('http://t/api/catalogo/alvos-anatomicos?id=e999');
    expect(status).toBe(404);
    expect(String(corpo.motivo)).toMatch(/não afirma nada sobre o que o exercício trabalha/);
  });

  it('a listagem sem id traz proveniência, os 44 alvos e os limites de discriminação', async () => {
    const { corpo } = await rota('http://t/api/catalogo/alvos-anatomicos');
    expect(Object.keys(corpo.alvos as object).length).toBe(44);
    expect((corpo.limitesDeDiscriminacao as unknown[]).length).toBeGreaterThan(0);
    expect((corpo.procedencia as { sha256: string }).sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('os 168 ids respondem — nenhum exercício da biblioteca abre sem resposta', async () => {
    for (const id of Object.keys(ANATOMIA_POR_EXERCICIO)) {
      const { status } = await rota(`http://t/api/catalogo/alvos-anatomicos?id=${id}`);
      expect(status, id).not.toBe(404);
    }
  });
});
