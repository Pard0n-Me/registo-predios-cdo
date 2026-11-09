// Lógica partilhada pelas páginas Mapa e Prédios: filtro, ordem, estado e cor do pino, linha de resumo.
import type { BuildingSummary } from '../types'
import { agoText, fmtDate } from '../ui'

export type Show = 'todos' | 'ativos' | 'fsbo'
export const SHOWS: [Show, string][] = [['todos', 'Todos'], ['ativos', 'À venda'], ['fsbo', 'Só FSBO']]
export type Sort = 'visita' | 'anuncio' | 'criado' | 'rua' | 'perto'
export const SORTS: [Sort, string][] = [['visita', 'Última visita'], ['anuncio', 'Último anúncio'], ['criado', 'Mais recentes'], ['rua', 'Rua (A–Z)'], ['perto', 'Mais perto']]

export function loadShow(): Show {
  try { const v = localStorage.getItem('filtro-predios'); return v === 'ativos' || v === 'fsbo' ? v : 'todos' } catch { return 'todos' }
}
export function saveShow(v: Show) { try { localStorage.setItem('filtro-predios', v) } catch { /* ignora */ } }
export function loadSort(): Sort {
  try { const v = localStorage.getItem('ordem-predios'); return SORTS.some(s => s[0] === v) ? (v as Sort) : 'visita' } catch { return 'visita' }
}
export function saveSort(v: Sort) { try { localStorage.setItem('ordem-predios', v) } catch { /* ignora */ } }

export const passesFilter = (s: BuildingSummary, show: Show) =>
  show === 'todos' || (show === 'ativos' ? s.activeListings > 0 : s.activeFsbo > 0)

/** Distância aproximada em metros (suficiente para ordenar dentro do bairro). */
export const distance = (a: { lat: number; lng: number }, lat: number | null, lng: number | null) =>
  lat == null || lng == null ? Infinity : Math.hypot((lat - a.lat) * 111_000, (lng - a.lng) * 87_000)

export function fmtDistance(m: number): string {
  if (!isFinite(m)) return ''
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`
}

const byStreet = (a: BuildingSummary, b: BuildingSummary) =>
  a.building.street.localeCompare(b.building.street, 'pt') || a.building.number.localeCompare(b.building.number, 'pt', { numeric: true })

export function sortBuildings(list: BuildingSummary[], sort: Sort, here: { lat: number; lng: number } | null): BuildingSummary[] {
  const cmp: Record<Sort, (a: BuildingSummary, b: BuildingSummary) => number> = {
    visita: (a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? '') || byStreet(a, b),
    anuncio: (a, b) => (b.lastListing?.at ?? '').localeCompare(a.lastListing?.at ?? '') || byStreet(a, b),
    criado: (a, b) => (b.building.created_at ?? '').localeCompare(a.building.created_at ?? '') || byStreet(a, b),
    rua: byStreet,
    perto: (a, b) => here ? distance(here, a.building.lat, a.building.lng) - distance(here, b.building.lat, b.building.lng) || byStreet(a, b) : byStreet(a, b),
  }
  return [...list].sort(cmp[sort])
}

export type PinState = 'venda' | 'recente' | 'antiga' | 'nunca'
/** Cores fixas: o mapa de fundo é sempre claro, também no modo escuro. Contrastes calculados na especificação (R8). */
export const PIN_COLORS: Record<PinState, string> = { venda: '#a63a32', recente: '#2f7d4f', antiga: '#965a00', nunca: '#6f757c' }
export const PIN_LABELS: Record<PinState, string> = { venda: 'À venda', recente: '< 6 meses', antiga: 'Antiga', nunca: 'Nunca' }
export const PIN_TEXT: Record<PinState, string> = { venda: 'À venda', recente: 'Visitado há menos de 6 meses', antiga: 'Visita antiga', nunca: 'Nunca visitado' }

const SIX_MONTHS = 1000 * 60 * 60 * 24 * 182
export function pinState(s: BuildingSummary): PinState {
  if (s.activeListings) return 'venda'
  if (s.lastVisit && Date.now() - new Date(s.lastVisit).getTime() < SIX_MONTHS) return 'recente'
  if (s.lastVisit || s.building.origin === 'legado') return 'antiga'
  return 'nunca'
}
export const pinColor = (s: BuildingSummary) => PIN_COLORS[pinState(s)]

/** A última visita é do dia de hoje (hora local do aparelho). */
export const visitedToday = (s: BuildingSummary) => !!s.lastVisit && new Date(s.lastVisit).toDateString() === new Date().toDateString()

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

const PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
/** Só apresentação: "Rua 4 De Infantaria" → "Rua 4 de Infantaria". A base não muda e a pesquisa continua igual. */
export const streetName = (street: string) =>
  street.split(' ').map((w, i) => (i > 0 && PARTICLES.has(w.toLowerCase()) ? w.toLowerCase() : w)).join(' ')
export const addressText = (b: { street: string; number: string }) => `${streetName(b.street)}, ${b.number}`

/** Ícone e tom de cada estado (os mesmos na lista, no cartão do mapa e na ficha). */
export const STATE_ICON: Record<PinState, 'tag' | 'check' | 'clock' | 'minus'> = { venda: 'tag', recente: 'check', antiga: 'clock', nunca: 'minus' }
export const STATE_TONE: Record<PinState, string> = { venda: 'bad', recente: 'ok', antiga: 'warn', nunca: 'gr' }

export const unitsCount = (s: BuildingSummary) => s.building.floors.reduce((a, f) => a + f.doors.length, 0)
/** "visitado hoje", "última visita 20/10/26" ou "sem visitas" (em minúsculas, para se juntar a outras partes). */
export const visitText = (s: BuildingSummary) =>
  visitedToday(s) ? 'visitado hoje' : s.lastVisit ? `última visita ${fmtDate(s.lastVisit)}` : 'sem visitas'
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/** Linha 2 da lista: o estado por escrito. À venda: `À venda · FSBO · T2` (um anúncio) ou `À venda · 3 anúncios`. */
export function stateLine(s: BuildingSummary): string {
  const st = pinState(s)
  if (st !== 'venda') return PIN_TEXT[st]
  if (s.activeListings > 1) return `À venda · ${s.activeListings} anúncios`
  return ['À venda', s.adFsbo ? 'FSBO' : 'FSBA', s.adTypology].filter(Boolean).join(' · ')
}

/** Linha 3 da lista: anúncio, visitas, frações e arrendamentos. */
export function detailLine(s: BuildingSummary): string {
  const parts: string[] = []
  if (s.activeListings && s.adAt) parts.push(`${s.activeListings > 1 ? 'Último anúncio' : 'Anúncio'} ${agoText(s.adAt)}`)
  parts.push(visitText(s))
  const n = unitsCount(s)
  if (n) parts.push(plural(n, 'fração', 'frações'))
  if (s.activeRentals) parts.push(plural(s.activeRentals, 'arrendamento', 'arrendamentos'))
  return cap(parts.join(' · '))
}

export function summaryLine(s: BuildingSummary) {
  const n = s.building.floors.reduce((a, f) => a + f.doors.length, 0)
  const parts = [n ? `${n} frações` : 'grelha por definir']
  parts.push(s.lastVisit ? `última visita ${fmtDate(s.lastVisit)}` : 'sem visitas')
  if (s.activeListings) parts.push(`${s.activeListings} ${s.activeListings === 1 ? 'anúncio de venda' : 'anúncios de venda'}`)
  if (s.activeRentals) parts.push(`${s.activeRentals} ${s.activeRentals === 1 ? 'arrendamento' : 'arrendamentos'}`)
  if (s.lastListing) parts.push(`anúncio inserido ${fmtDate(s.lastListing.at)} (${s.lastListing.source === 'radar' ? 'radar' : 'manual'})`)
  return parts.join(' · ')
}

/** Separa "correia teles 90" em rua e número. */
export function splitAddress(q: string): { street: string; number: string } {
  const m = q.trim().match(/^(.*?)[\s,]+(\d+[a-zA-Z]?)\s*$/)
  const street = (m ? m[1] : q).trim()
  const pretty = street.replace(/\b\w/g, c => c.toUpperCase())
  return { street: /^(rua|r\.|av|avenida|praça|praca|largo|travessa)\b/i.test(pretty) ? pretty : `Rua ${pretty}`, number: m ? m[2] : '' }
}
