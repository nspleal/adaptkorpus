import Link from 'next/link';
import { KAscendente } from '@/lib/brand/Logo';

export default function Conta() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center gap-3">
        <KAscendente size={40} />
        <Link href="/" className="text-sm text-secundario hover:text-bone">
          ← início
        </Link>
      </header>
      <h1 className="text-2xl font-bold">Conta e assinatura</h1>
      <p className="text-secundario">
        Em breve: login (Supabase Auth), status da assinatura (Kiwify), e seus direitos de
        dados (LGPD) — exportar e excluir seus dados a qualquer momento.
      </p>
    </main>
  );
}
