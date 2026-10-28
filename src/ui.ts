import type { Channel, CommercialStatus, Cond, Delivery, Outcome, Piece, Role, Tri, VisitResult } from './types'

export const OUTCOMES: [Outcome, string][] = [
  ['nao_abriu', 'Não abriu'], ['caixa_cheia', 'Caixa cheia'], ['carta_mao', 'Carta em mão'],
  ['carta_correio', 'Carta no correio'], ['carta_porta', 'Carta na porta'], ['postal', 'Postal'],
  ['bloco', 'Bloco'], ['recusou', 'Não quis falar'], ['falei', 'Falei'], ['no_correio', 'No correio'],
]
export const outcomeLabel = (o: Outcome) => OUTCOMES.find(x => x[0] === o)?.[1] ?? o
/** Resultados que se escolhem na porta (as entregas registam-se à parte, como peça + canal). */
// Duas colunas no ecrã da porta: à esquerda o contacto, à direita o correio. "No correio" = deixei na caixa sem tocar.
export const RESULT_COLS: [Outcome, string][][] = [
  [['falei', 'Falei'], ['nao_abriu', 'Não abriu'], ['recusou', 'Não quis falar']],
  [['no_correio', 'No correio'], ['caixa_cheia', 'Caixa cheia']],
]
export const RESULTS: [Outcome, string][] = RESULT_COLS.flat()
export const CHANNELS: [Channel, string][] = [['porta', 'Na porta'], ['caixa', 'Caixa do correio'], ['mao', 'Em mão']]
export const channelLabel = (c: Channel) => CHANNELS.find(x => x[0] === c)?.[1] ?? 'canal ?'
export const deliveryLabel = (d: Delivery, pieces: Piece[]) =>
  `${pieces.find(p => p.id === d.piece)?.short_name ?? 'peça ?'}${d.channel === '?' ? '' : ' · ' + channelLabel(d.channel).toLowerCase()}`
/** Texto curto do resultado de uma porta: resultados + entregas. */
export const resultText = (r: { outcomes: Outcome[]; deliveries?: Delivery[] }, pieces: Piece[]) =>
  [...r.outcomes.map(outcomeLabel), ...(r.deliveries ?? []).map(d => deliveryLabel(d, pieces))].join(' + ')

export const ROLES: [Role, string][] = [
  ['proprietario', 'Proprietário'], ['inquilino', 'Inquilino'], ['familiar', 'Familiar'], ['empregada', 'Empregada'],
  ['porteira', 'Porteira'], ['administrador', 'Administrador'], ['vizinho', 'Vizinho'], ['outro', 'Outro'],
]
export const roleLabel = (r: Role) => ROLES.find(x => x[0] === r)?.[1] ?? r

export const COMPANIONS = ['Nádia', 'Inês', 'Adriana', 'Rita']

export const TRI: [Tri, string][] = [['sim', 'Sim'], ['nao', 'Não'], ['?', '?']]
export const COND: [Cond, string][] = [['bom', 'Bom'], ['razoavel', 'Razoável'], ['mau', 'Mau'], ['obras', 'Em obras'], ['?', '?']]
export const condLabel = (c: Cond) => COND.find(x => x[0] === c)?.[1] ?? c
export const STATUS: [CommercialStatus, string][] = [
  ['nada', '—'], ['fsbo', 'FSBO ativo'], ['fsba', 'FSBA ativo'], ['vendido', 'Vendido'], ['arrendado', 'Arrendado'], ['vigilancia', 'Em vigilância'],
]
export const statusLabel = (s: CommercialStatus) => STATUS.find(x => x[0] === s)?.[1] ?? s

/** Cor da célula da grelha a partir do último resultado e do estado comercial. */
export function cellClass(status: CommercialStatus | undefined, r: VisitResult | undefined): string {
  if (status === 'fsbo' || status === 'fsba') return 'r-venda'
  if (!r) return ''
  if (r.outcomes.includes('falei')) return 'r-falei'
  if (r.outcomes.includes('caixa_cheia')) return 'r-cheia'
  if (r.outcomes.includes('recusou')) return 'r-recusou'
  return 'r-carta'
}

export function fmtDate(iso: string | null | undefined, yearUncertain = false): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0')
  return yearUncertain ? `${dd}/${mm}/??` : `${dd}/${mm}/${String(d.getFullYear()).slice(2)}`
}
export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return `${fmtDate(iso)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export const fmtPrice = (n: number) => n.toLocaleString('pt-PT', { maximumFractionDigits: 0 }) + ' €'

/** Valor para <input type="datetime-local"> na hora local. */
export function toLocalInput(d = new Date()): string {
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}

export function go(path: string) { location.hash = path }
