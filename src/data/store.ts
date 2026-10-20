import { db } from './adapter'
import type {
  Building, BuildingFull, BuildingSummary, Floor, Interaction, Listing, ListingPrice, Outcome,
  Person, PersonUnit, Role, Unit, UnitNote, Visit, VisitResult,
} from '../types'

export const unitLabel = (floor: string, door: string) => (door ? `${floor} ${door}` : floor)

export async function listBuildings(): Promise<BuildingSummary[]> {
  const [buildings, visits, listings] = await Promise.all([
    db.all<Building>('buildings'), db.all<Visit>('visits'), db.all<Listing>('listings'),
  ])
  return buildings.map(b => {
    const vs = visits.filter(v => v.building_id === b.id)
    const last = vs.map(v => v.visited_at).sort().at(-1) ?? null
    return { building: b, lastVisit: last, visitCount: vs.length, activeListings: listings.filter(l => l.building_id === b.id && l.active).length,
      activeFsbo: listings.filter(l => l.building_id === b.id && l.active && l.advertiser_type === 'particular').length }
  })
}

export async function getBuildingFull(id: string): Promise<BuildingFull> {
  const [[building], units, visits, listings] = await Promise.all([
    db.where<Building>('buildings', 'id', id), db.where<Unit>('units', 'building_id', id),
    db.where<Visit>('visits', 'building_id', id), db.where<Listing>('listings', 'building_id', id),
  ])
  if (!building) throw new Error('Prédio não encontrado')
  const unitIds = units.map(u => u.id)
  const [results, prices, personUnits, interactions, unitNotes] = await Promise.all([
    db.whereIn<VisitResult>('visit_results', 'visit_id', visits.map(v => v.id)),
    db.whereIn<ListingPrice>('listing_prices', 'listing_id', listings.map(l => l.id)),
    db.whereIn<PersonUnit>('person_units', 'unit_id', unitIds),
    db.whereIn<Interaction>('interactions', 'unit_id', unitIds),
    db.whereIn<UnitNote>('unit_notes', 'unit_id', unitIds),
  ])
  const contactIds = listings.map(l => l.contact_person_id).filter((x): x is string => !!x)
  const people = await db.whereIn<Person>('people', 'id', [...new Set([...personUnits.map(p => p.person_id), ...contactIds])])
  visits.sort((a, b) => b.visited_at.localeCompare(a.visited_at))
  return { building, units, visits, results, listings, prices, people, personUnits, interactions, unitNotes }
}

/** Garante que existe uma fração para cada célula da grelha (nunca apaga frações). */
async function ensureUnits(buildingId: string, floors: Floor[]) {
  const existing = await db.where<Unit>('units', 'building_id', buildingId)
  const have = new Set(existing.map(u => u.label))
  for (const f of floors) for (const d of f.doors) {
    const label = unitLabel(f.label, d)
    if (!have.has(label)) {
      await db.insert('units', { building_id: buildingId, label, condition: '?', commercial_status: 'nada' })
      have.add(label)
    }
  }
}

export async function saveBuilding(b: Partial<Building> & { street: string; number: string }): Promise<Building> {
  const { id, created_at: _c, updated_at: _u, ...data } = b
  const saved = id ? await db.update<Building>('buildings', id, data) : await db.insert<Building>('buildings', data)
  await ensureUnits(saved.id, saved.floors ?? [])
  return saved
}

export async function setBuildingPosition(id: string, lat: number, lng: number) {
  return db.update<Building>('buildings', id, { lat, lng })
}

export async function ensureUnit(buildingId: string, label: string): Promise<Unit> {
  const found = (await db.where<Unit>('units', 'building_id', buildingId)).find(u => u.label === label)
  return found ?? db.insert<Unit>('units', { building_id: buildingId, label, condition: '?', commercial_status: 'nada' })
}

export interface PersonInput {
  existingId?: string
  name: string; role: Role; phone: string; email: string; traits: string; conversation: string
}
export interface ResultInput {
  unitId: string
  outcomes: Outcome[]
  note: string
  person?: PersonInput
  otherUnitNote?: { unitId: string; text: string }
}
export interface VisitInput {
  buildingId: string
  visitedAt: string
  companion: string | null
  generalNote: string
  results: ResultInput[]
}

export async function saveVisit(v: VisitInput): Promise<Visit> {
  const visit = await db.insert<Visit>('visits', {
    building_id: v.buildingId, visited_at: v.visitedAt, year_uncertain: false,
    companion: v.companion, general_note: v.generalNote || null, raw_text: null, origin: 'novo',
  })
  for (const r of v.results) {
    if (!r.outcomes.length && !r.note) continue
    await db.insert('visit_results', { visit_id: visit.id, unit_id: r.unitId, outcomes: r.outcomes, note: r.note || null })
    let source: string | null = null
    if (r.person && r.person.name.trim()) {
      const p = r.person
      let personId = p.existingId
      if (!personId) {
        const created = await db.insert<Person>('people', {
          name: p.name.trim(), phone: p.phone || null, email: p.email || null, traits: p.traits || null, notes: null, pipedrive_person_id: null,
        })
        personId = created.id
      } else if (p.phone || p.email || p.traits) {
        const patch: Record<string, string> = {}
        if (p.phone) patch.phone = p.phone
        if (p.email) patch.email = p.email
        if (p.traits) patch.traits = p.traits
        await db.update('people', personId, patch)
      }
      await db.upsert('person_units', { person_id: personId, unit_id: r.unitId, role: p.role }, ['person_id', 'unit_id'])
      await db.insert('interactions', { person_id: personId, unit_id: r.unitId, visit_id: visit.id, at: v.visitedAt, notes: p.conversation || null })
      source = p.name.trim()
    }
    if (r.otherUnitNote && r.otherUnitNote.text.trim()) {
      await db.insert('unit_notes', { unit_id: r.otherUnitNote.unitId, visit_id: visit.id, source, text: r.otherUnitNote.text.trim(), at: v.visitedAt })
    }
  }
  return visit
}

export async function deleteVisit(id: string) { return db.remove('visits', id) }
/** Apaga o anúncio (e os preços). Se a fração ficou sem anúncios ativos, deixa de estar marcada como à venda. */
export async function deleteListing(l: Listing) {
  await db.remove('listings', l.id)
  if (!l.unit_id) return
  const others = (await db.where<Listing>('listings', 'unit_id', l.unit_id)).filter(x => x.active)
  const [u] = await db.where<Unit>('units', 'id', l.unit_id)
  if (!others.length && u && (u.commercial_status === 'fsbo' || u.commercial_status === 'fsba')) await db.update('units', u.id, { commercial_status: 'nada' })
}

/**
 * Junta uma fração "fora da grelha" (ex.: "2.º", criada por um anúncio sem Esq/Dto) a uma fração da grelha:
 * anúncios, resultados de visitas, pessoas, conversas e notas passam para a fração de destino; os dados
 * da fração (tipologia, área, estado, notas…) só preenchem o que no destino estiver vazio. No fim apaga a fração de origem.
 */
export async function mergeUnit(fromId: string, toId: string) {
  if (fromId === toId) return
  const [[from], [to]] = await Promise.all([db.where<Unit>('units', 'id', fromId), db.where<Unit>('units', 'id', toId)])
  if (!from || !to || from.building_id !== to.building_id) throw new Error('Frações não encontradas no mesmo prédio')
  for (const l of await db.where<Listing>('listings', 'unit_id', fromId)) await db.update('listings', l.id, { unit_id: toId })
  const toResults = await db.where<VisitResult>('visit_results', 'unit_id', toId)
  for (const r of await db.where<VisitResult>('visit_results', 'unit_id', fromId)) {
    const same = toResults.find(x => x.visit_id === r.visit_id)
    if (same) {
      await db.update('visit_results', same.id, { outcomes: [...new Set([...same.outcomes, ...r.outcomes])], note: [same.note, r.note].filter(Boolean).join(' · ') || null })
      await db.remove('visit_results', r.id)
    } else await db.update('visit_results', r.id, { unit_id: toId })
  }
  for (const pu of await db.where<PersonUnit>('person_units', 'unit_id', fromId)) {
    await db.upsert('person_units', { person_id: pu.person_id, unit_id: toId, role: pu.role }, ['person_id', 'unit_id'])
    await db.removeMatch('person_units', { person_id: pu.person_id, unit_id: fromId })
  }
  for (const i of await db.where<Interaction>('interactions', 'unit_id', fromId)) await db.update('interactions', i.id, { unit_id: toId })
  for (const n of await db.where<UnitNote>('unit_notes', 'unit_id', fromId)) await db.update('unit_notes', n.id, { unit_id: toId })
  const patch: Partial<Unit> = {}
  if (!to.typology && from.typology) patch.typology = from.typology
  if (to.area_m2 == null && from.area_m2 != null) patch.area_m2 = from.area_m2
  if (to.condition === '?' && from.condition !== '?') patch.condition = from.condition
  if (to.commercial_status === 'nada' && from.commercial_status !== 'nada') patch.commercial_status = from.commercial_status
  if (to.pipedrive_deal_id == null && from.pipedrive_deal_id != null) patch.pipedrive_deal_id = from.pipedrive_deal_id
  if (from.notes) patch.notes = [to.notes, from.notes].filter(Boolean).join('\n')
  if (Object.keys(patch).length) await db.update('units', toId, patch)
  await db.remove('units', fromId)
}

/** Apaga uma fração vazia (sem anúncios, visitas, pessoas nem notas). */
export async function deleteEmptyUnit(id: string) {
  const [ls, rs, pus, ns] = await Promise.all([db.where('listings', 'unit_id', id), db.where('visit_results', 'unit_id', id), db.where('person_units', 'unit_id', id), db.where('unit_notes', 'unit_id', id)])
  if (ls.length || rs.length || pus.length || ns.length) throw new Error('A fração tem registos: junta-a a outra em vez de a apagar.')
  await db.remove('units', id)
}

export async function updateUnit(id: string, patch: Partial<Unit>) { return db.update<Unit>('units', id, patch) }
/** Cria uma pessoa sem fração (ex.: contacto de um anúncio com andar incerto). */
export async function createPerson(p: { name: string; phone?: string; email?: string; traits?: string; notes?: string }) {
  return (await db.insert<Person>('people', {
    name: p.name.trim(), phone: p.phone?.trim() || null, email: p.email?.trim() || null,
    traits: p.traits?.trim() || null, notes: p.notes?.trim() || null, pipedrive_person_id: null,
  })).id
}

/** Liga uma pessoa a uma fração sem visita (ex.: dono de uma placa de venda). Cria a pessoa ou usa uma já existente. */
export async function addPersonToUnit(unitId: string, p: { existingId?: string; name: string; role: Role; phone?: string; email?: string; traits?: string; notes?: string }) {
  let personId = p.existingId
  if (!personId) {
    const created = await db.insert<Person>('people', {
      name: p.name.trim(), phone: p.phone?.trim() || null, email: p.email?.trim() || null,
      traits: p.traits?.trim() || null, notes: p.notes?.trim() || null, pipedrive_person_id: null,
    })
    personId = created.id
  }
  await db.upsert('person_units', { person_id: personId, unit_id: unitId, role: p.role }, ['person_id', 'unit_id'])
  return personId
}

export async function updatePerson(id: string, patch: Partial<Person>) { return db.update<Person>('people', id, patch) }
export async function addUnitNote(unitId: string, text: string, source: string | null) {
  return db.insert<UnitNote>('unit_notes', { unit_id: unitId, visit_id: null, source, text, at: new Date().toISOString() })
}

export async function getPerson(id: string) {
  const [[person], personUnits, interactions] = await Promise.all([
    db.where<Person>('people', 'id', id), db.where<PersonUnit>('person_units', 'person_id', id), db.where<Interaction>('interactions', 'person_id', id),
  ])
  const units = await db.whereIn<Unit>('units', 'id', personUnits.map(p => p.unit_id))
  const buildings = await db.whereIn<Building>('buildings', 'id', [...new Set(units.map(u => u.building_id))])
  interactions.sort((a, b) => b.at.localeCompare(a.at))
  return { person, personUnits, interactions, units, buildings }
}

export async function searchPeople(q: string): Promise<Person[]> {
  const n = norm(q)
  if (n.length < 2) return []
  return (await db.all<Person>('people')).filter(p => norm(`${p.name} ${p.phone ?? ''} ${p.traits ?? ''}`).includes(n)).slice(0, 20)
}

export interface ListingInput extends Partial<Listing> { building_id: string; price?: number | null; price_at?: string }
export async function saveListing(l: ListingInput): Promise<Listing> {
  const { id, price, price_at, ...data } = l
  const saved = id ? await db.update<Listing>('listings', id, data) : await db.insert<Listing>('listings', data)
  if (price) await db.insert('listing_prices', { listing_id: saved.id, at: price_at || saved.first_seen, price })
  // O estado da fração acompanha o anúncio, também ao editar (ativar, retirar, mudar de anunciante)
  if (saved.unit_id) {
    const [u] = await db.where<Unit>('units', 'id', saved.unit_id)
    const active = (await db.where<Listing>('listings', 'unit_id', saved.unit_id)).filter(x => x.active && x.operation === 'venda')
    const want = active.length ? (active.some(x => x.advertiser_type === 'particular') ? 'fsbo' : 'fsba') : null
    if (u && want && u.commercial_status !== want && (u.commercial_status === 'nada' || u.commercial_status === 'fsbo' || u.commercial_status === 'fsba'))
      await db.update('units', u.id, { commercial_status: want })
    if (u && !want && (u.commercial_status === 'fsbo' || u.commercial_status === 'fsba')) await db.update('units', u.id, { commercial_status: 'nada' })
  }
  return saved
}

export function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(rua|r\.|avenida|av\.|praca|largo|travessa|tv\.|de|da|do|dos|das)\b/g, ' ')
    .replace(/[,.º°ª]/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function geocode(street: string, number: string): Promise<{ lat: number; lng: number } | null> {
  // Só dentro de Campo de Ourique: há ruas com o mesmo nome noutras zonas (ex.: Rua 4 de Infantaria).
  const q = new URLSearchParams({ format: 'json', limit: '1', street: `${number} ${street}`, city: 'Lisboa', viewbox: '-9.1780,38.7250,-9.1540,38.7110', bounded: '1' })
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, { headers: { 'Accept-Language': 'pt' } })
  if (!r.ok) return null
  const j = (await r.json()) as { lat: string; lon: string }[]
  return j[0] ? { lat: +j[0].lat, lng: +j[0].lon } : null
}
