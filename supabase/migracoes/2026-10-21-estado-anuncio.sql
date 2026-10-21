-- 21/10/2026 · Estado de conservação dito no anúncio (passa para a fração se lá estiver "?").
-- Colar no Supabase › SQL Editor › New query › Run. Pode correr-se mais de uma vez.
alter table listings add column if not exists condition text check (condition in ('bom','razoavel','mau','obras','?'));
