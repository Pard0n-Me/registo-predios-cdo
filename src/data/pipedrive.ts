// Leitura da etapa de um negócio do Pipedrive (função /api/pipedrive-deal na Vercel). Só leitura.
import { supabase } from './adapter'

export interface DealInfo { id: number; title: string; status: string; pipeline_id: number; stage: string | null; updated: string }
export type DealResult = { ok: true; deal: DealInfo } | { ok: false; msg: string }

export async function fetchDeal(id: number): Promise<DealResult> {
  if (!supabase) return { ok: false, msg: 'Modo demonstração: sem ligação ao Pipedrive.' }
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  if (!t) return { ok: false, msg: 'Sem sessão.' }
  try {
    const r = await fetch(`/api/pipedrive-deal?id=${id}`, { headers: { authorization: `Bearer ${t}` } })
    const j = await r.json().catch(() => ({})) as Partial<DealInfo> & { error?: string }
    if (r.ok) return { ok: true, deal: j as DealInfo }
    if (j.error === 'sem_token') return { ok: false, msg: 'Falta o token do Pipedrive na Vercel (PIPEDRIVE_API_TOKEN).' }
    if (j.error === 'nao_existe') return { ok: false, msg: 'Este ID não existe no Pipedrive.' }
    return { ok: false, msg: `Não consegui ler o Pipedrive (${j.error ?? r.status}).` }
  } catch {
    return { ok: false, msg: 'Sem rede: não consegui ler o Pipedrive.' }
  }
}

export const statusPt = (s: string) => ({ open: 'aberto', won: 'ganho', lost: 'perdido', deleted: 'apagado' } as Record<string, string>)[s] ?? s
