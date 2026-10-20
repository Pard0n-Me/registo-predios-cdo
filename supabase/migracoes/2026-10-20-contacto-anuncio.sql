-- 20/10/2026 · Contacto do anúncio (pessoa que atende o anúncio: dono num FSBO, agente num FSBA).
-- Colar no Supabase › SQL Editor › New query › Run. Pode correr-se mais de uma vez.
alter table listings add column if not exists contact_person_id uuid references people(id) on delete set null;
