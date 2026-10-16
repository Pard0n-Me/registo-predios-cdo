-- Registo de Prédios CdO · esquema v1 (16 Out 2026)
-- Colar no Supabase › SQL Editor › New query › Run. Pode correr-se mais de uma vez.
-- Valores "sim" / "nao" / "?" : "?" é sempre válido (não se preenche por suposição).

create extension if not exists pgcrypto;

create table if not exists buildings (
  id uuid primary key default gen_random_uuid(),
  street text not null,
  number text not null,
  corner_note text,                    -- ex.: gaveto com Sampaio Bruno
  lat double precision,
  lng double precision,
  -- grelha: [{"label":"3.º","doors":["Esq","Dto"]}, ...] do piso mais alto para o mais baixo
  floors jsonb not null default '[]'::jsonb,
  construction text not null default '?' check (construction in ('betao','tabique','misto','?')),
  elevator text not null default '?' check (elevator in ('sim','nao','?')),
  garage text not null default '?' check (garage in ('sim','nao','?')),
  storage text not null default '?' check (storage in ('sim','nao','?')),
  storage_note text,
  ground_commerce text not null default '?' check (ground_commerce in ('sim','nao','?')),
  commerce_desc text,
  porter text not null default '?' check (porter in ('sim','nao','?')),
  mailbox text not null default '?' check (mailbox in ('exterior','interior','?')),
  horizontal_property text not null default '?' check (horizontal_property in ('sim','nao','?')),
  orientation text not null default '?',
  cond_ext text not null default '?' check (cond_ext in ('bom','razoavel','mau','obras','?')),
  cond_int text not null default '?' check (cond_int in ('bom','razoavel','mau','obras','?')),
  condo_admin text,
  notes text,
  origin text not null default 'novo' check (origin in ('novo','legado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (street, number)
);

create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  label text not null,                 -- "3.º Esq"
  typology text,
  area_m2 numeric,
  condition text not null default '?' check (condition in ('bom','razoavel','mau','obras','?')),
  commercial_status text not null default 'nada'
    check (commercial_status in ('nada','fsbo','fsba','vendido','arrendado','vigilancia')),
  pipedrive_deal_id bigint,
  notes text,
  created_at timestamptz not null default now(),
  unique (building_id, label)
);

create table if not exists visits (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  visited_at timestamptz not null default now(),
  year_uncertain boolean not null default false,   -- notas antigas sem ano: "ano a confirmar"
  companion text,                                  -- null = sozinho
  general_note text,
  raw_text text,                                   -- texto original (legado ou ditado)
  origin text not null default 'novo' check (origin in ('novo','legado')),
  created_at timestamptz not null default now()
);

create table if not exists visit_results (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  outcomes text[] not null default '{}',  -- nao_abriu, caixa_cheia, carta_mao, carta_correio, carta_porta, postal, bloco, recusou, falei
  note text,
  unique (visit_id, unit_id)
);

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  traits text,                          -- traços para reconhecer
  notes text,
  pipedrive_person_id bigint,
  created_at timestamptz not null default now()
);

-- Ligação pessoa ↔ fração (uma pessoa pode estar ligada a várias)
create table if not exists person_units (
  person_id uuid not null references people(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  role text not null default 'outro'
    check (role in ('proprietario','inquilino','familiar','empregada','porteira','administrador','vizinho','outro')),
  primary key (person_id, unit_id)
);

create table if not exists interactions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  unit_id uuid references units(id) on delete set null,
  visit_id uuid references visits(id) on delete set null,
  at timestamptz not null default now(),
  notes text
);

-- O que se sabe de uma fração por terceiros ("o 4.º D era de uns suecos que venderam")
create table if not exists unit_notes (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  visit_id uuid references visits(id) on delete set null,
  source text,                          -- ex.: "disse a vizinha do RC A"
  text text not null,
  at timestamptz not null default now()
);

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  unit_id uuid references units(id) on delete set null,
  floor_hint text,                      -- "3.º (?)" quando o andar não é certo
  operation text not null default 'venda' check (operation in ('venda','arrendamento')),
  first_seen date not null default current_date,
  first_seen_uncertain boolean not null default false,
  typology text,
  area_m2 numeric,
  advertiser_type text not null default '?' check (advertiser_type in ('particular','agencia','promotor','?')),
  advertiser text,                      -- ex.: "KW", "C21"
  exclusivity text,                     -- sim / não / até quando
  url text,
  source text,                          -- radar, idealista, maxwork, legado…
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists listing_prices (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  at date not null default current_date,
  price numeric not null
);

create index if not exists units_building_idx on units(building_id);
create index if not exists visits_building_idx on visits(building_id, visited_at desc);
create index if not exists results_visit_idx on visit_results(visit_id);
create index if not exists listings_building_idx on listings(building_id);

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists buildings_touch on buildings;
create trigger buildings_touch before update on buildings for each row execute function touch_updated_at();

-- Segurança: só utilizadores autenticados (só o António; registos novos desligados no painel)
do $$
declare t text;
begin
  foreach t in array array['buildings','units','visits','visit_results','people','person_units','interactions','unit_notes','listings','listing_prices']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "so autenticado" on %I', t);
    execute format('create policy "so autenticado" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
