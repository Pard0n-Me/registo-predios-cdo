// Exportação para Excel: CSV com ";" e BOM (abre direito no Excel em português).
import { db } from './adapter'
import type { Building, Interaction, Listing, ListingPrice, Person, PersonUnit, Unit, Visit, VisitResult } from '../types'
import { condLabel, fmtDate, outcomeLabel, roleLabel, statusLabel } from '../ui'

const cell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
const csv = (head: string[], rows: unknown[][]) => '﻿' + [head, ...rows].map(r => r.map(cell).join(';')).join('\r\n')
const tri = (v: string) => (v === 'sim' ? 'Sim' : v === 'nao' ? 'Não' : '?')
const iso = (s: string | null | undefined) => (s ? s.slice(0, 10) : '')

export async function buildExports() {
  const [buildings, units, visits, results, people, personUnits, interactions, listings, prices] = await Promise.all([
    db.all<Building>('buildings'), db.all<Unit>('units'), db.all<Visit>('visits'), db.all<VisitResult>('visit_results'),
    db.all<Person>('people'), db.all<PersonUnit>('person_units'), db.all<Interaction>('interactions'),
    db.all<Listing>('listings'), db.all<ListingPrice>('listing_prices'),
  ])
  const bById = new Map(buildings.map(b => [b.id, b]))
  const uById = new Map(units.map(u => [u.id, u]))
  const vById = new Map(visits.map(v => [v.id, v]))
  const pById = new Map(people.map(p => [p.id, p]))
  const byStreet = (a: Building, b: Building) => a.street.localeCompare(b.street, 'pt') || a.number.localeCompare(b.number, 'pt', { numeric: true })
  const lastPrice = (l: Listing) => prices.filter(p => p.listing_id === l.id).sort((a, b) => b.at.localeCompare(a.at))[0]?.price ?? ''

  // 1. Uma linha por fração (prédios sem frações têm uma linha só com o prédio)
  const fr: unknown[][] = []
  for (const b of [...buildings].sort(byStreet)) {
    const base = [b.street, b.number, b.origin, b.construction === 'betao' ? 'Betão' : b.construction, tri(b.elevator), tri(b.garage), tri(b.storage),
      b.ground_commerce === 'sim' ? b.commerce_desc || 'Sim' : tri(b.ground_commerce), tri(b.porter), b.mailbox, tri(b.horizontal_property),
      b.orientation, condLabel(b.cond_ext), condLabel(b.cond_int), b.condo_admin, b.notes, b.lat, b.lng]
    const us = units.filter(u => u.building_id === b.id).sort((a, c) => a.label.localeCompare(c.label, 'pt', { numeric: true }))
    if (!us.length) { fr.push([...base, '', '', '', '', '', '', '', '', '', '']); continue }
    for (const u of us) {
      const rs = results.filter(r => r.unit_id === u.id).map(r => ({ r, v: vById.get(r.visit_id) })).sort((a, c) => (c.v?.visited_at ?? '').localeCompare(a.v?.visited_at ?? ''))
      const last = rs[0]
      const ppl = personUnits.filter(pu => pu.unit_id === u.id).map(pu => { const p = pById.get(pu.person_id); return p ? [p.name, roleLabel(pu.role), p.phone, p.email].filter(Boolean).join(' · ') : '' }).filter(Boolean).join(' | ')
      const ls = listings.filter(l => l.unit_id === u.id && l.active).map(l => `${l.operation} ${lastPrice(l)} € (${l.advertiser_type === 'particular' ? 'FSBO' : l.advertiser ?? '?'})`).join(' | ')
      fr.push([...base, u.label, u.typology, u.area_m2, condLabel(u.condition), statusLabel(u.commercial_status),
        last?.v ? iso(last.v.visited_at) : '', last ? last.r.outcomes.map(outcomeLabel).join(' + ') : '', ppl, ls, u.notes])
    }
  }
  const fracoes = csv(['Rua', 'Nº', 'Origem', 'Construção', 'Elevador', 'Garagens', 'Arrecadações', 'Comércio RC', 'Porteira', 'Caixas do correio', 'PH',
    'Orientação', 'Conservação exterior', 'Conservação interior', 'Administração', 'Notas do prédio', 'Latitude', 'Longitude',
    'Fração', 'Tipologia', 'Área m²', 'Conservação', 'Estado comercial', 'Última visita', 'Último resultado', 'Pessoas', 'Anúncios ativos', 'Notas da fração'], fr)

  // 2. Uma linha por porta visitada (visitas sem resultados têm uma linha com a nota geral)
  const vi: unknown[][] = []
  for (const v of [...visits].sort((a, b) => b.visited_at.localeCompare(a.visited_at))) {
    const b = bById.get(v.building_id); if (!b) continue
    const rs = results.filter(r => r.visit_id === v.id)
    const head = [iso(v.visited_at), v.year_uncertain ? 'Sim' : '', b.street, b.number, v.companion ?? '']
    if (!rs.length) { vi.push([...head, '', '', '', '', '', v.general_note, v.origin]); continue }
    for (const r of rs) {
      const ints = interactions.filter(i => i.visit_id === v.id && i.unit_id === r.unit_id)
      vi.push([...head, uById.get(r.unit_id)?.label, r.outcomes.map(outcomeLabel).join(' + '), r.note,
        ints.map(i => pById.get(i.person_id)?.name).filter(Boolean).join(' | '), ints.map(i => i.notes).filter(Boolean).join(' | '), v.general_note, v.origin])
    }
  }
  const visitas = csv(['Data', 'Ano a confirmar', 'Rua', 'Nº', 'Acompanhante', 'Fração', 'Resultado', 'Nota da porta', 'Pessoa', 'Conversa', 'Nota geral', 'Origem'], vi)

  // 3. Uma linha por anúncio
  const an = listings.map(l => {
    const b = bById.get(l.building_id)
    const ps = prices.filter(p => p.listing_id === l.id).sort((a, c) => a.at.localeCompare(c.at))
    return [b?.street, b?.number, l.unit_id ? uById.get(l.unit_id)?.label : l.floor_hint, l.operation, fmtDate(l.first_seen, l.first_seen_uncertain), l.typology, l.area_m2,
      l.advertiser_type === 'particular' ? 'Particular (FSBO)' : l.advertiser, l.exclusivity, lastPrice(l), ps.map(p => `${iso(p.at)}: ${p.price}`).join(' | '),
      l.active ? 'Ativo' : 'Retirado', l.source, l.url, l.notes]
  })
  const anuncios = csv(['Rua', 'Nº', 'Fração / andar', 'Operação', 'Visto', 'Tipologia', 'Área m²', 'Anunciante', 'Exclusividade', 'Preço atual', 'Histórico de preços', 'Estado', 'Fonte', 'Link', 'Notas'], an)

  return { fracoes, visitas, anuncios, counts: { fracoes: fr.length, visitas: vi.length, anuncios: an.length } }
}

export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
