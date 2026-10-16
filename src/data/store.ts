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
    return { building: b, lastVisit: last, visitCount: vs.length, activeListings: listings.filter(l => l.building_id === b.id && l.active).length }
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
  const people = await db.whereIn<Person>('people', 'id', [...new Set(personUnits.map(p => p.person_id))])
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

export async function updateUnit(id: string, patch: Partial<Unit>) { return db.update<Unit>('units', id, patch) }
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
  if (saved.unit_id && saved.active && !id) {
    const status = saved.operation === 'venda' ? (saved.advertiser_type === 'particular' ? 'fsbo' : 'fsba') : null
    if (status) await db.update('units', saved.unit_id, { commercial_status: status })
  }
  return saved
}

export function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(rua|r\.|avenida|av\.|praca|largo|travessa|tv\.|de|da|do|dos|das)\b/g, ' ')
    .replace(/[,.º°ª]/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function geocode(street: string, number: string): Promise<{ lat: number; lng: number } | null> {
  const q = encodeURIComponent(`${street} ${number}, Lisboa, Portugal`)
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`, { headers: { 'Accept-Language': 'pt' } })
  if (!r.ok) return null
  const j = (await r.json()) as { lat: string; lon: string }[]
  return j[0] ? { lat: +j[0].lat, lng: +j[0].lon } : null
}
