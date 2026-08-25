-- C1.1-E — avisa outros dispositivos sem expor o conteúdo do plano.
-- A política é a única alteração em realtime.messages: o schema é gerenciado pelo Supabase.
-- O usuário só pode ASSINAR o tópico privado derivado do seu próprio auth.uid(); não há policy
-- de INSERT para browser. A mensagem transporta exclusivamente a revisão confirmada pelo CAS.

drop policy if exists "c1_usuario_recebe_revisao_do_proprio_plano" on realtime.messages;
create policy "c1_usuario_recebe_revisao_do_proprio_plano"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) = ('user:' || (select auth.uid())::text || ':plano')
);

create or replace function public.notificar_revisao_do_plano()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('revision', new.revision),
    'plano_atualizado',
    'user:' || new.user_id::text || ':plano',
    true
  );
  return null;
end;
$$;

-- A função só é chamada pelo trigger; nenhum papel externo deve invocá-la.
revoke all on function public.notificar_revisao_do_plano() from public, anon, authenticated;

drop trigger if exists c1_notificar_revisao_do_plano on public.plano_cas;
create trigger c1_notificar_revisao_do_plano
after insert or update of revision on public.plano_cas
for each row
execute function public.notificar_revisao_do_plano();
