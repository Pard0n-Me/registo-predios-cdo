-- 04/11/2026 · Estado "vendido" nos anúncios, com mês e valor de venda (ambos opcionais).
-- Um anúncio vendido fica também com active = false (não conta como "à venda").
-- Colar no Supabase › SQL Editor › New query › Run. Pode correr-se mais de uma vez.
alter table listings add column if not exists sold boolean not null default false;
alter table listings add column if not exists sold_at date;          -- dia 1 do mês da venda
alter table listings add column if not exists sold_price integer;    -- valor de venda (€)
