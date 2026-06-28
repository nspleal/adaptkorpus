/**
 * Leitura central das variáveis do Supabase.
 * A anon key é pública por design (protegida por RLS). A service_role NUNCA é lida aqui
 * (ela vive só em código de servidor confiável — ver src/lib/supabase/admin.ts).
 */
export function supabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) throw new Error('NEXT_PUBLIC_SUPABASE_URL não configurada.');
  return v;
}

export function supabaseAnonKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!v) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY não configurada.');
  return v;
}

/** true quando o ambiente Supabase está configurado (evita quebrar dev sem backend). */
export function supabaseConfigurado(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
