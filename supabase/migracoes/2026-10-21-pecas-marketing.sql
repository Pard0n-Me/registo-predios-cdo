-- 21/10/2026 · Peças de marketing e entregas na porta (peça × canal) + autocolante "publicidade não".
-- Colar no Supabase › SQL Editor › New query › Run. Pode correr-se mais de uma vez.
-- Correr ANTES de publicar a versão da app que usa estas colunas.

-- 1. Lista de peças (o António acrescenta e arquiva na app; arquivar = active false, nunca apagar)
create table if not exists marketing_pieces (
  id uuid primary key default gen_random_uuid(),
  name text not null,                  -- ex.: "Postal Posicionamento 2024"
  short_name text not null,            -- texto do botão, ex.: "Postal"
  thumb text,                          -- miniatura (imagem pequena em data URL)
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table marketing_pieces enable row level security;
drop policy if exists "so autenticado" on marketing_pieces;
create policy "so autenticado" on marketing_pieces for all to authenticated using (true) with check (true);

-- Peças genéricas para o histórico (resultados antigos sem modelo conhecido); arquivadas
insert into marketing_pieces (id, name, short_name, active, sort) values
  ('00000000-0000-4000-8000-0000000000c1', 'Carta (modelo antigo)', 'Carta antiga', false, 900),
  ('00000000-0000-4000-8000-0000000000c2', 'Postal (modelo antigo)', 'Postal antigo', false, 901),
  ('00000000-0000-4000-8000-0000000000c3', 'Bloco (modelo antigo)', 'Bloco antigo', false, 902)
on conflict (id) do nothing;

-- 2. Entregas por porta: [{"piece": "<id da peça>", "channel": "porta" | "caixa" | "mao" | "?"}]
alter table visit_results add column if not exists deliveries jsonb not null default '[]'::jsonb;

-- 3. Autocolante "publicidade não" no prédio
alter table buildings add column if not exists no_ads text not null default '?' check (no_ads in ('sim','nao','?'));

-- 4. Converter os resultados antigos: cartas/postais/blocos passam a entregas; ficam só os resultados
update visit_results r set
  deliveries = r.deliveries || coalesce((
    select jsonb_agg(jsonb_build_object('piece', m.piece, 'channel', m.channel))
    from unnest(r.outcomes) o
    join (values
      ('carta_mao',     '00000000-0000-4000-8000-0000000000c1', 'mao'),
      ('carta_correio', '00000000-0000-4000-8000-0000000000c1', 'caixa'),
      ('carta_porta',   '00000000-0000-4000-8000-0000000000c1', 'porta'),
      ('postal',        '00000000-0000-4000-8000-0000000000c2', '?'),
      ('bloco',         '00000000-0000-4000-8000-0000000000c3', '?')
    ) m(outcome, piece, channel) on m.outcome = o
  ), '[]'::jsonb),
  outcomes = array(select o from unnest(r.outcomes) o where o not in ('carta_mao','carta_correio','carta_porta','postal','bloco'))
where r.outcomes && array['carta_mao','carta_correio','carta_porta','postal','bloco'];
