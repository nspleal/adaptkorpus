import { canonicalInputHash } from '@/lib/engine/cas';
const igual = (a: unknown, b: unknown) => canonicalInputHash({ presente: a !== undefined, valor: a ?? null }) === canonicalInputHash({ presente: b !== undefined, valor: b ?? null });
const objeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export interface Mescla<T> {
    valor: T;
    conflitos: string[];
}
/** Três vias. Ausência é diferente de null. Arrays são uma unidade, exceto dias com ID
 * estável: nunca inferimos que a posição 2 em dois aparelhos é a mesma entidade. */
export function mesclarTresVias<T>(base: T, local: T, servidor: T): Mescla<T> {
    const conflitos: string[] = [];
    function visitar(b: unknown, l: unknown, s: unknown, caminho: string): unknown {
        if (igual(l, b))
            return structuredClone(s);
        if (igual(s, b) || igual(l, s))
            return structuredClone(l);
        if (objeto(b) && objeto(l) && objeto(s)) {
            const resultado: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
            for (const k of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(s)])) {
                const ausenteL = !Object.hasOwn(l, k), ausenteS = !Object.hasOwn(s, k);
                if (ausenteL && ausenteS)
                    continue;
                if (ausenteL !== ausenteS && Object.hasOwn(b, k)) {
                    const sobrevivente = ausenteL ? s[k] : l[k];
                    if (igual(sobrevivente, b[k]))
                        continue;
                    conflitos.push(`${caminho}/${k}`);
                    if (!ausenteS)
                        resultado[k] = structuredClone(s[k]);
                    continue;
                }
                resultado[k] = visitar(b[k], l[k], s[k], `${caminho}/${k}`);
            }
            return resultado;
        }
        const idEstavel = caminho.endsWith('/rotinaCustom/dias') ? 'diaId'
            : caminho === '/dados/estados' ? 'exercicioId'
                : caminho === '/dados/exs' ? 'uid'
                    : caminho.startsWith('/dados/') && caminho.endsWith('/sets') ? 'id' : null;
        if (idEstavel && [b, l, s].every(Array.isArray)) {
            const mapear = (v: unknown) => {
                const a = v as Record<string, unknown>[];
                if (a.some((d) => !objeto(d) || typeof d[idEstavel] !== 'string'))
                    return null;
                const ids = a.map((d) => d[idEstavel] as string);
                return new Set(ids).size === a.length ? Object.fromEntries(a.map((d) => [d[idEstavel] as string, d])) : null;
            };
            const bm = mapear(b), lm = mapear(l), sm = mapear(s);
            // Adição/remoção/reordenação concorrente exige escolha; só editamos dias existentes.
            if (bm && lm && sm && igual(Object.keys(bm), Object.keys(lm)) && igual(Object.keys(bm), Object.keys(sm))) {
                const m = visitar(bm, lm, sm, caminho) as Record<string, unknown>;
                return Object.keys(sm).map((id) => m[id]);
            }
        }
        conflitos.push(caminho || '/');
        return structuredClone(s);
    }
    return { valor: visitar(base, local, servidor, '') as T, conflitos };
}
/** Escolha local só nos caminhos conflitantes. Alterações remotas independentes ficam. */
export function manterLocalNosConflitos<T>(base: T, local: T, servidor: T): T {
    const m = mesclarTresVias(base, local, servidor);
    if (m.conflitos.includes('/'))
        return structuredClone(local);
    const valor = m.valor;
    const chave = (v: unknown, k: string): string | number => Array.isArray(v) ? v.findIndex((d: unknown) => objeto(d) && [d.diaId, d.exercicioId, d.uid, d.id].includes(k)) : k;
    for (const caminho of m.conflitos) {
        const partes = caminho.split('/').slice(1);
        let destino: unknown = valor, origem: unknown = local;
        for (const k of partes.slice(0, -1)) {
            if (!destino || !origem)
                break;
            destino = (destino as Record<string | number, unknown>)[chave(destino, k)];
            origem = (origem as Record<string | number, unknown>)[chave(origem, k)];
        }
        if (!destino || !origem)
            continue;
        const fim = partes.at(-1)!;
        const campo = chave(destino, fim), campoOrigem = chave(origem, fim);
        if (!Object.hasOwn(origem as object, campoOrigem))
            delete (destino as Record<string | number, unknown>)[campo];
        else
            Object.defineProperty(destino, campo, { value: structuredClone((origem as Record<string | number, unknown>)[campoOrigem]), enumerable: true, configurable: true, writable: true });
    }
    return valor;
}
