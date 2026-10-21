'use client';

let geracao = 0;

/** Trocar de identidade invalida inclusive A → B → A; refresh da mesma conta não. */
export function invalidarContinuacoesConta(): void { geracao += 1; }

/** O chamador fornece o dono e, na UI, a vida do componente. Sem relógio ou I/O. */
export function continuacaoDaConta(
  lerDono: () => string | null,
  subject = lerDono(),
  vivo: () => boolean = () => true,
): () => boolean {
  const inicio = geracao;
  return () => vivo() && geracao === inicio && lerDono() === subject;
}
