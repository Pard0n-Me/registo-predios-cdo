// Dados FICTÍCIOS do modo demonstração. Pessoas inventadas; posições no mapa ilustrativas.
type Row = Record<string, unknown>

const base = {
  corner_note: null, construction: '?', elevator: '?', garage: '?', storage: '?', storage_note: null,
  ground_commerce: '?', commerce_desc: null, porter: '?', mailbox: '?', horizontal_property: '?',
  orientation: '?', cond_ext: '?', cond_int: '?', condo_admin: null, notes: null, origin: 'novo',
}

export function demoSeed(): Record<string, Row[]> {
  const b1 = 'demo-b1', b2 = 'demo-b2', b3 = 'demo-b3'
  const floors2 = (labels: string[]) => labels.map(label => ({ label, doors: ['Esq', 'Dto'] }))
  const buildings: Row[] = [
    { ...base, id: b1, street: 'Rua Exemplo A', number: '90', lat: 38.7192, lng: -9.1668,
      floors: floors2(['3.º', '2.º', '1.º', 'RC']), construction: 'betao', elevator: 'nao', ground_commerce: 'nao',
      porter: 'nao', mailbox: 'interior', horizontal_property: 'sim', orientation: 'Nascente/Poente', cond_ext: 'razoavel',
      condo_admin: 'Condómino do 2.º Dto (a confirmar)' },
    { ...base, id: b2, street: 'Rua Exemplo A', number: '73', lat: 38.7189, lng: -9.1652,
      floors: ['3.º', '2.º', '1.º', 'RC'].map(label => ({ label, doors: [''] })), mailbox: 'exterior' },
    { ...base, id: b3, street: 'Rua Exemplo B', number: '12', lat: 38.7172, lng: -9.1641, floors: floors2(['2.º', '1.º', 'RC']),
      ground_commerce: 'sim', commerce_desc: 'Pastelaria (exemplo)' },
  ]
  const units: Row[] = []
  for (const b of buildings) for (const f of b.floors as { label: string; doors: string[] }[]) for (const d of f.doors)
    units.push({ id: `${b.id}-${f.label}-${d}`, building_id: b.id, label: d ? `${f.label} ${d}` : f.label, typology: null, area_m2: null,
      condition: '?', commercial_status: 'nada', pipedrive_deal_id: null, notes: null })
  const u = (b: string, label: string) => units.find(x => x.building_id === b && x.label === label)!.id as string
  units.find(x => x.id === u(b2, '2.º'))!.commercial_status = 'fsbo'
  Object.assign(units.find(x => x.id === u(b2, '2.º'))!, { typology: 'T2', area_m2: 67 })

  const v1 = 'demo-v1', v0 = 'demo-v0'
  const visits: Row[] = [
    { id: v1, building_id: b1, visited_at: '2026-08-23T10:40:00Z', year_uncertain: false, companion: 'Nádia', general_note: 'Entrámos com a vizinha do RC Esq.', raw_text: null, origin: 'novo' },
    { id: v0, building_id: b1, visited_at: '2023-10-12T12:00:00Z', year_uncertain: false, companion: null, general_note: 'Postais no correio', raw_text: '12/10/23 - postais no correio', origin: 'legado' },
  ]
  const r = (visit_id: string, unit_id: string, outcomes: string[], note: string | null = null) => ({ id: crypto.randomUUID(), visit_id, unit_id, outcomes, note })
  const results: Row[] = [
    r(v1, u(b1, '3.º Esq'), ['falei', 'bloco', 'postal']), r(v1, u(b1, '3.º Dto'), ['nao_abriu', 'postal']),
    r(v1, u(b1, '2.º Esq'), ['falei', 'bloco', 'postal']), r(v1, u(b1, '2.º Dto'), ['recusou']),
    r(v1, u(b1, '1.º Esq'), ['nao_abriu', 'postal']), r(v1, u(b1, '1.º Dto'), ['nao_abriu', 'postal']),
    r(v1, u(b1, 'RC Esq'), ['falei', 'bloco']), r(v1, u(b1, 'RC Dto'), ['caixa_cheia']),
  ]
  const p1 = 'demo-p1', p2 = 'demo-p2'
  const people: Row[] = [
    { id: p1, name: 'Marta (exemplo)', phone: null, email: null, traits: 'Cabelo curto, simpática', notes: null, pipedrive_person_id: null },
    { id: p2, name: 'Pessoa B (exemplo)', phone: '910000000', email: null, traits: 'Tem dois cães; carro no parque em frente', notes: null, pipedrive_person_id: null },
  ]
  const person_units: Row[] = [
    { person_id: p1, unit_id: u(b1, '3.º Esq'), role: 'proprietario' },
    { person_id: p2, unit_id: u(b1, '2.º Esq'), role: 'proprietario' },
  ]
  const interactions: Row[] = [
    { id: crypto.randomUUID(), person_id: p1, unit_id: u(b1, '3.º Esq'), visit_id: v1, at: '2026-08-23T10:45:00Z', notes: 'Não conhece ninguém que queira vender.' },
    { id: crypto.randomUUID(), person_id: p2, unit_id: u(b1, '2.º Esq'), visit_id: v1, at: '2026-08-23T10:50:00Z', notes: 'Não sabe de ninguém a vender.' },
  ]
  const unit_notes: Row[] = [
    { id: crypto.randomUUID(), unit_id: u(b1, '1.º Dto'), visit_id: v1, source: 'Pessoa B (2.º Esq)', text: 'Os donos vivem fora; casa quase sempre vazia.', at: '2026-08-23T10:50:00Z' },
  ]
  const l1 = 'demo-l1'
  const listings: Row[] = [
    { id: l1, building_id: b2, unit_id: u(b2, '2.º'), floor_hint: null, operation: 'venda', first_seen: '2025-10-20', first_seen_uncertain: false,
      typology: 'T2', area_m2: 67, advertiser_type: 'particular', advertiser: null, exclusivity: null, url: 'https://www.idealista.pt/',
      source: 'radar', active: true, notes: null },
  ]
  const listing_prices: Row[] = [{ id: crypto.randomUUID(), listing_id: l1, at: '2025-10-20', price: 365000 }]
  return { buildings, units, visits, visit_results: results, people, person_units, interactions, unit_notes, listings, listing_prices }
}
