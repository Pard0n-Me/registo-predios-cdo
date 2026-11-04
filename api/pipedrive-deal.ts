// Vercel Function, só de leitura: devolve a etapa de um negócio do Pipedrive para a ficha da fração.
// Decisão de 04/11 (app-06): a app não escreve no Pipedrive; só o Claude Code escreve.
// Variável na Vercel (do lado do servidor, nunca VITE_): PIPEDRIVE_API_TOKEN.
// Só responde a quem tem sessão iniciada na app (token da Supabase no cabeçalho Authorization).

const SB_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const SB_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
const PD = 'https://api.pipedrive.com/v1'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

async function pd<T>(path: string, token: string): Promise<T | null> {
  const r = await fetch(`${PD}${path}${path.includes('?') ? '&' : '?'}api_token=${encodeURIComponent(token)}`)
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`Pipedrive ${r.status}`)
  return ((await r.json()) as { data: T | null }).data
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? ''
  if (!/^\d{1,10}$/.test(id)) return json({ error: 'id inválido' }, 400)

  // 1. Sessão da app
  const auth = request.headers.get('authorization') ?? ''
  if (!SB_URL || !SB_KEY || !auth.startsWith('Bearer ')) return json({ error: 'sem sessão' }, 401)
  const who = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, authorization: auth } }).catch(() => null)
  if (!who?.ok) return json({ error: 'sem sessão' }, 401)

  // 2. Pipedrive (só GET)
  const token = process.env.PIPEDRIVE_API_TOKEN
  if (!token) return json({ error: 'sem_token' }, 503)
  try {
    const deal = await pd<{ id: number; title: string; status: string; stage_id: number; pipeline_id: number; update_time: string }>(`/deals/${id}`, token)
    if (!deal) return json({ error: 'nao_existe' }, 404)
    const stage = await pd<{ name: string }>(`/stages/${deal.stage_id}`, token)
    return json({ id: deal.id, title: deal.title, status: deal.status, pipeline_id: deal.pipeline_id, stage: stage?.name ?? null, updated: deal.update_time })
  } catch (e) {
    return json({ error: (e as Error).message }, 502)
  }
}
