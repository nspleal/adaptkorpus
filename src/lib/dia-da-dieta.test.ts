import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  HORARIO_REFEICAO, TOLERANCIA_MIN, diaCompleto, horaDe, linhaDoDia, registradas,
  medidaDoIngrediente,
} from './dia-da-dieta';
import type { StatusRefeicao } from '@/components/painel/RegistroRefeicao';

/** Cardápio típico de 4 slots. */
const R = ['cafe', 'almoco', 'lanche', 'jantar'];
const L = (o: Record<string, StatusRefeicao> = {}) => o;
const estados = (logs: Record<string, StatusRefeicao>, agoraMin: number) =>
  Object.fromEntries(linhaDoDia(R, logs, agoraMin).map((l) => [l.id, l.estado]));

const semComentarios = (caminho: string): string =>
  readFileSync(caminho, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('linha do dia — a próxima refeição pelo relógio', () => {
  it('`dia-dieta-inicio`: nada registrado, de manhã cedo → o Café é o destaque', () => {
    expect(estados(L(), 6 * 60)).toEqual({
      cafe: 'proxima', almoco: 'futura', lanche: 'futura', jantar: 'futura',
    });
  });

  it('`dia-dieta-padrao`: Café registrado ao meio-dia → Almoço em destaque, futuras recolhidas', () => {
    expect(estados(L({ cafe: 'seguiu' }), 12 * 60)).toEqual({
      cafe: 'registrada', almoco: 'proxima', lanche: 'futura', jantar: 'futura',
    });
  });

  it('`dia-dieta-completo`: as 4 registradas → ninguém em destaque', () => {
    const logs = L({ cafe: 'seguiu', almoco: 'fora', lanche: 'seguiu', jantar: 'seguiu' });
    expect(estados(logs, 21 * 60)).toEqual({
      cafe: 'registrada', almoco: 'registrada', lanche: 'registrada', jantar: 'registrada',
    });
    expect(diaCompleto(R, logs)).toBe(true);
    expect(registradas(R, logs)).toBe(4);
  });

  it('"comi outra coisa" também é REGISTRO — a linha sai do destaque igual', () => {
    // Trava do cofre: os dois botões têm o mesmo peso; `fora` nunca é pendência.
    expect(estados(L({ cafe: 'fora' }), 12 * 60).cafe).toBe('registrada');
  });

  describe('janela de tolerância', () => {
    it('dentro da tolerância a refeição segue sendo a próxima', () => {
      // 13:00 — 30 min depois do almoço (12:30), dentro dos 90.
      expect(estados(L({ cafe: 'seguiu' }), 13 * 60).almoco).toBe('proxima');
      // exatamente no limite (12:30 + 90 = 14:00) ainda conta.
      const limite = HORARIO_REFEICAO.almoco! + TOLERANCIA_MIN;
      expect(estados(L({ cafe: 'seguiu' }), limite).almoco).toBe('proxima');
    });

    it('passada a tolerância, o destaque anda para a refeição seguinte', () => {
      const passou = HORARIO_REFEICAO.almoco! + TOLERANCIA_MIN + 1;
      const e = estados(L({ cafe: 'seguiu' }), passou);
      expect(e.almoco).toBe('futura');
      expect(e.lanche).toBe('proxima');
    });
  });

  it('todas passaram e faltam registros → destaca a MAIS ANTIGA pendente', () => {
    // 23:30: nenhuma refeição está mais na janela; o Café é a pendência mais antiga.
    const e = estados(L({ almoco: 'seguiu' }), 23 * 60 + 30);
    expect(e.cafe).toBe('proxima');
    expect(e.lanche).toBe('futura');
    expect(e.jantar).toBe('futura');
  });

  it('o destaque é ÚNICO em qualquer horário e qualquer combinação de registros', () => {
    // Varredura: 24 h × todas as 16 combinações de registro dos 4 slots.
    for (let min = 0; min < 24 * 60; min += 10) {
      for (let mask = 0; mask < 16; mask++) {
        const logs: Record<string, StatusRefeicao> = {};
        R.forEach((r, i) => { if (mask & (1 << i)) logs[r] = 'seguiu'; });
        const linhas = linhaDoDia(R, logs, min);
        const destaques = linhas.filter((l) => l.estado === 'proxima');
        const faltam = R.some((r) => !logs[r]);
        expect(destaques.length, `min=${min} mask=${mask}`).toBe(faltam ? 1 : 0);
        // Uma linha registrada NUNCA vira destaque.
        for (const l of linhas) if (logs[l.id]) expect(l.estado).toBe('registrada');
      }
    }
  });

  it('respeita a ordem cronológica e mapeia o índice do cardápio', () => {
    // Cardápio fora de ordem: a linha do dia reordena, mas `idx` continua apontando p/ o item.
    const fora = ['jantar', 'cafe', 'almoco'];
    const linhas = linhaDoDia(fora, L(), 6 * 60);
    expect(linhas.map((l) => l.id)).toEqual(['cafe', 'almoco', 'jantar']);
    expect(linhas.map((l) => l.idx)).toEqual([1, 2, 0]);
  });

  it('plano de 3 refeições funciona (nem todo cardápio tem lanche)', () => {
    const tres = ['cafe', 'almoco', 'jantar'];
    const linhas = linhaDoDia(tres, L({ cafe: 'seguiu' }), 12 * 60);
    expect(linhas.map((l) => l.estado)).toEqual(['registrada', 'proxima', 'futura']);
    expect(registradas(tres, L({ cafe: 'seguiu' }))).toBe(1);
  });

  it('cardápio vazio não quebra nem inventa destaque', () => {
    expect(linhaDoDia([], L(), 12 * 60)).toEqual([]);
    expect(diaCompleto([], L())).toBe(false);
  });
});

describe('horaDe', () => {
  it('formata HH:MM com zero à esquerda', () => {
    expect(horaDe(7 * 60 + 30)).toBe('07:30');
    expect(horaDe(12 * 60 + 30)).toBe('12:30');
    expect(horaDe(0)).toBe('00:00');
    expect(horaDe(20 * 60)).toBe('20:00');
  });
});

describe('medida caseira + gramas', () => {
  const bife = { medidaCaseira: '1 bife médio', gramasDaMedida: 100 };

  it('quantidade ≈ 1 medida → a medida da base, como ela é', () => {
    expect(medidaDoIngrediente(bife, 100)).toBe('1 bife médio · 100 g');
    expect(medidaDoIngrediente(bife, 105)).toBe('1 bife médio · 105 g');
  });

  it('fora da medida → multiplicador explícito (nada de plural inventado)', () => {
    expect(medidaDoIngrediente(bife, 200)).toBe('2× 1 bife médio · 200 g');
    expect(medidaDoIngrediente(bife, 50)).toBe('0,5× 1 bife médio · 50 g');
    expect(medidaDoIngrediente(bife, 150)).toBe('1,5× 1 bife médio · 150 g');
  });

  it('nunca escreve "1×" — quando arredonda para 1 medida, mostra só a medida', () => {
    // Caso real do cardápio: 7 g de azeite com a colher de 8 g (n = 0,875).
    const azeite = { medidaCaseira: '1 colher de sopa', gramasDaMedida: 8 };
    expect(medidaDoIngrediente(azeite, 7)).toBe('1 colher de sopa · 7 g');
    // 115 g ÷ 100 g = 1,15 — fora da banda do "≈ 1", mas arredonda para 1 medida.
    expect(medidaDoIngrediente(bife, 115)).toBe('1 bife médio · 115 g');
    // 130 g ÷ 100 g = 1,3 arredonda para 1,5 — a meia medida é o menor passo que mostramos.
    expect(medidaDoIngrediente(bife, 130)).toBe('1,5× 1 bife médio · 130 g');
  });

  it('sem medida caseira na base → só as gramas (não fabricamos medida)', () => {
    expect(medidaDoIngrediente({}, 120)).toBe('120 g');
    expect(medidaDoIngrediente({ medidaCaseira: '1 xícara' }, 120)).toBe('120 g');
    expect(medidaDoIngrediente({ medidaCaseira: '1 xícara', gramasDaMedida: 0 }, 120)).toBe('120 g');
  });
});

describe('determinismo — o relógio não mora no módulo', () => {
  it('o módulo puro não lê `new Date()` fora do helper explícito da UI', () => {
    const src = semComentarios('src/lib/dia-da-dieta.ts');
    // `agoraEmMinutos` é o ÚNICO ponto que toca o relógio, e é a UI que o chama.
    const ocorrencias = src.match(/new Date\(\)/g) ?? [];
    expect(ocorrencias.length).toBe(1);
    expect(src).toMatch(/export function agoraEmMinutos/);
    // O motor continua limpo: nada de dia-da-dieta dentro de lib/engine.
    expect(semComentarios('src/lib/engine/index.ts')).not.toContain('dia-da-dieta');
  });

  it('mesma entrada → mesma saída', () => {
    const logs = L({ cafe: 'seguiu' });
    const a = JSON.stringify(linhaDoDia(R, logs, 12 * 60));
    const b = JSON.stringify(linhaDoDia(R, logs, 12 * 60));
    expect(a).toBe(b);
  });
});
