-- AI costs page (2026-11-13): every voice / camera call now records the model and its token counts, and the dashboard turns them
-- into money. Also a small settings table (monthly budget, token prices, Google billing account id for the Pay button).
-- Old rows stay as they are (no tokens); the dashboard estimates those per call, as the Overview always did.

alter table public.ai_usage_log
  add column model text check (char_length(model) <= 80),
  add column input_tokens integer check (input_tokens >= 0),
  add column audio_tokens integer check (audio_tokens >= 0), -- the part of input_tokens that was audio (priced higher)
  add column output_tokens integer check (output_tokens >= 0); -- answer tokens + thinking tokens (both billed as output)

-- Same caller as before (the two Edge Functions, as the signed-in user); the old 3-argument version stays for functions not redeployed yet.
create function public.log_ai_usage(p_kind text, p_ok boolean, p_ms integer, p_model text, p_in integer, p_audio integer, p_out integer) returns void
language sql security definer set search_path = '' as $$
  insert into public.ai_usage_log (user_id, kind, ok, ms, model, input_tokens, audio_tokens, output_tokens)
  values (auth.uid(), p_kind, p_ok, least(greatest(p_ms, 0), 600000), left(p_model, 80),
          least(greatest(p_in, 0), 100000000), least(greatest(p_audio, 0), 100000000), least(greatest(p_out, 0), 100000000));
$$;
revoke execute on function public.log_ai_usage(text, boolean, integer, text, integer, integer, integer) from public, anon;
grant execute on function public.log_ai_usage(text, boolean, integer, text, integer, integer, integer) to authenticated;

-- ─── Settings: one row per key, no grants, read and written only by the functions below ───
create table public.app_settings (
  key text primary key check (key in ('ai_budget', 'ai_prices', 'billing_account')),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

-- Owner only. p_budget: monthly dollars (null clears). p_prices: {input, audio, output} dollars per million tokens.
-- p_billing: the Google Cloud billing account id, like 01A2B3-C4D5E6-F7A8B9 (null clears).
create function public.admin_ai_settings_save(p_budget numeric, p_prices jsonb, p_billing text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(array['owner']) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_budget is not null and (p_budget < 0 or p_budget > 1000000) then raise exception 'bad_budget' using errcode = '22023'; end if;
  if p_billing is not null and p_billing !~ '^[0-9A-Fa-f]{6}-[0-9A-Fa-f]{6}-[0-9A-Fa-f]{6}$' then raise exception 'bad_billing' using errcode = '22023'; end if;
  if p_prices is not null and not (
       jsonb_typeof(p_prices) = 'object' and (select count(*) from jsonb_object_keys(p_prices)) = 3
       and p_prices ?& array['input', 'audio', 'output']
       and (p_prices ->> 'input') ~ '^\d{1,4}(\.\d{1,4})?$' and (p_prices ->> 'audio') ~ '^\d{1,4}(\.\d{1,4})?$'
       and (p_prices ->> 'output') ~ '^\d{1,4}(\.\d{1,4})?$') then
    raise exception 'bad_prices' using errcode = '22023';
  end if;
  if p_budget is null then delete from public.app_settings where key = 'ai_budget';
  else insert into public.app_settings (key, value) values ('ai_budget', to_jsonb(p_budget))
       on conflict (key) do update set value = excluded.value, updated_at = now(); end if;
  if p_billing is null then delete from public.app_settings where key = 'billing_account';
  else insert into public.app_settings (key, value) values ('billing_account', to_jsonb(upper(p_billing)))
       on conflict (key) do update set value = excluded.value, updated_at = now(); end if;
  if p_prices is not null then
    insert into public.app_settings (key, value) values ('ai_prices', p_prices)
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  insert into public.admin_audit_log (admin_id, action, target, detail)
  values (auth.uid(), 'ai_settings', 'app_settings', jsonb_build_object('budget', p_budget, 'billing_set', p_billing is not null));
end $$;

-- ─── Everything the AI costs page draws, in one call ───
-- daily: last 31 days (Cairo days) by kind and model. users: this Cairo month by user, kind and model (owner/admin only; viewers get []).
-- Costs are worked out by the page from the token sums and the saved prices.
create function public.admin_ai_usage() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  month_start timestamptz := date_trunc('month', now() at time zone 'Africa/Cairo') at time zone 'Africa/Cairo';
begin
  perform public.require_admin();
  return jsonb_build_object(
    'month_start', month_start,
    'settings', coalesce((select jsonb_object_agg(key, value) from public.app_settings), '{}'::jsonb),
    'daily', coalesce((
      select jsonb_agg(r) from (
        select ((created_at at time zone 'Africa/Cairo')::date)::text as day, kind, coalesce(model, '') as model,
               count(*) as calls, count(*) filter (where not ok) as failed,
               count(*) filter (where input_tokens is null) as untracked,
               coalesce(sum(input_tokens), 0) as input_tokens, coalesce(sum(audio_tokens), 0) as audio_tokens, coalesce(sum(output_tokens), 0) as output_tokens
        from public.ai_usage_log where created_at > now() - interval '31 days' group by 1, 2, 3
      ) r), '[]'::jsonb),
    'users', case when public.has_role(array['owner', 'admin']) then coalesce((
      select jsonb_agg(r) from (
        select l.user_id, coalesce(nullif(p.full_name, ''), u.email::text, '—') as name, u.email::text as email, l.kind, coalesce(l.model, '') as model,
               count(*) as calls, count(*) filter (where l.input_tokens is null) as untracked,
               coalesce(sum(l.input_tokens), 0) as input_tokens, coalesce(sum(l.audio_tokens), 0) as audio_tokens, coalesce(sum(l.output_tokens), 0) as output_tokens
        from public.ai_usage_log l
        left join public.profiles p on p.id = l.user_id
        left join auth.users u on u.id = l.user_id
        where l.created_at >= month_start group by 1, 2, 3, 4, 5
      ) r), '[]'::jsonb) else '[]'::jsonb end
  );
end $$;

revoke execute on function public.admin_ai_settings_save(numeric, jsonb, text), public.admin_ai_usage() from public, anon;
grant execute on function public.admin_ai_settings_save(numeric, jsonb, text), public.admin_ai_usage() to authenticated;
