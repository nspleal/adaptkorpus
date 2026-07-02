'use client';

import { ERROS_COMUNS } from '@/lib/data/erros-comuns';

/**
 * Lista de "erros comuns" de execução de um exercício. Dado curado do cofre
 * (conceitos/erros-comuns-exercicios-evokorpus, chave = id da biblioteca A1) — porte do
 * slot que antes era "em breve" na tela do exercício. Cada item é "erro → correção".
 *
 * Marcador NEUTRO de propósito: no app o vermelho é reservado a erro/segurança; um erro
 * comum de execução é EDUCACIONAL, não um alarme. Trava do cofre: dica geral, nunca
 * promete "prevenir lesão"/"corrigir postura" — só forma mais eficiente e segura.
 */
export function temErrosComuns(exId: string): boolean {
  return (ERROS_COMUNS[exId]?.length ?? 0) > 0;
}

export function ListaErrosComuns({ exId }: { exId: string }) {
  const itens = ERROS_COMUNS[exId];
  if (!itens || itens.length === 0) return null;
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
      {itens.map((item, i) => {
        const sep = item.indexOf('→');
        const erro = (sep >= 0 ? item.slice(0, sep) : item).trim();
        const correcao = sep >= 0 ? item.slice(sep + 1).trim() : '';
        return (
          <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '.88rem', lineHeight: 1.5 }}>
            <span aria-hidden style={{ flexShrink: 0, marginTop: 7, width: 5, height: 5, borderRadius: '50%', background: 'rgba(234,229,219,.4)' }} />
            <span>
              <span style={{ color: 'rgba(234,229,219,.55)' }}>{erro}</span>
              {correcao && (<>
                <span aria-hidden style={{ color: 'rgba(234,229,219,.4)', margin: '0 6px' }}>→</span>
                <span style={{ color: '#EAE5DB', fontWeight: 500 }}>{correcao}</span>
              </>)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
