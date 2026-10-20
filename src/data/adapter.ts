// Acesso às tabelas: Supabase (produção) ou localStorage (modo demonstração, sem configuração).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { demoSeed } from './demoSeed'

type Row = Record<string, unknown>

export interface Adapter {
  demo: boolean
  all<T>(table: string): Promise<T[]>
  where<T>(table: string, col: string, value: unknown): Promise<T[]>
  whereIn<T>(table: string, col: string, values: unknown[]): Promise<T[]>
  insert<T>(table: string, row: Row): Promise<T>
  update<T>(table: string, id: string, patch: Row): Promise<T>
  upsert(table: string, row: Row, keys: string[]): Promise<void>
  remove(table: string, id: string): Promise<void>
  removeMatch(table: string, match: Row): Promise<void>
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

function supabaseAdapter(sb: SupabaseClient): Adapter {
  const check = <T>(r: { data: T | null; error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message)
    return r.data as T
  }
  return {
    demo: false,
    async all<T>(table: string) { return check<T[]>(await sb.from(table).select('*')) },
    async where<T>(table: string, col: string, value: unknown) { return check<T[]>(await sb.from(table).select('*').eq(col, value)) },
    async whereIn<T>(table: string, col: string, values: unknown[]) {
      if (!values.length) return []
      return check<T[]>(await sb.from(table).select('*').in(col, values))
    },
    async insert<T>(table: string, row: Row) { return check<T>(await sb.from(table).insert(row).select().single()) },
    async update<T>(table: string, id: string, patch: Row) { return check<T>(await sb.from(table).update(patch).eq('id', id).select().single()) },
    async upsert(table: string, row: Row, keys: string[]) {
      check(await sb.from(table).upsert(row, { onConflict: keys.join(',') }))
    },
    async remove(table: string, id: string) { check(await sb.from(table).delete().eq('id', id)) },
    async removeMatch(table: string, match: Row) { check(await sb.from(table).delete().match(match)) },
  }
}

const DEMO_KEY = 'registo-predios-demo-v1'

function demoAdapter(): Adapter {
  let db: Record<string, Row[]>
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    db = raw ? JSON.parse(raw) : demoSeed()
  } catch { db = demoSeed() }
  const save = () => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)) } catch { /* sem armazenamento */ } }
  const t = (name: string) => (db[name] ??= [])
  const clone = <T>(x: unknown) => structuredClone(x) as T
  return {
    demo: true,
    async all<T>(table: string) { return clone<T[]>(t(table)) },
    async where<T>(table: string, col: string, value: unknown) { return clone<T[]>(t(table).filter(r => r[col] === value)) },
    async whereIn<T>(table: string, col: string, values: unknown[]) { return clone<T[]>(t(table).filter(r => values.includes(r[col]))) },
    async insert<T>(table: string, row: Row) {
      const r = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row }
      t(table).push(r); save(); return clone<T>(r)
    },
    async update<T>(table: string, id: string, patch: Row) {
      const r = t(table).find(x => x.id === id)
      if (!r) throw new Error('Registo não encontrado')
      Object.assign(r, patch, { updated_at: new Date().toISOString() }); save(); return clone<T>(r)
    },
    async upsert(table: string, row: Row, keys: string[]) {
      const r = t(table).find(x => keys.every(k => x[k] === row[k]))
      if (r) Object.assign(r, row); else t(table).push({ ...row })
      save()
    },
    async remove(table: string, id: string) {
      // imita as regras da base: apagar uma visita leva os resultados; um anúncio leva os preços
      const child: Record<string, [string, string]> = { visits: ['visit_results', 'visit_id'], listings: ['listing_prices', 'listing_id'] }
      db[table] = t(table).filter(x => x.id !== id)
      const c = child[table]; if (c) db[c[0]] = t(c[0]).filter(x => x[c[1]] !== id)
      for (const n of ['interactions', 'unit_notes']) if (table === 'visits') t(n).forEach(x => { if (x.visit_id === id) x.visit_id = null })
      save()
    },
    async removeMatch(table: string, match: Row) {
      db[table] = t(table).filter(x => !Object.entries(match).every(([k, v]) => x[k] === v))
      save()
    },
  }
}

export const db: Adapter = supabase ? supabaseAdapter(supabase) : demoAdapter()

export function resetDemo() {
  try { localStorage.removeItem(DEMO_KEY) } catch { /* ignora */ }
  location.reload()
}
