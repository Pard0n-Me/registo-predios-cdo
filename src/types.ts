export type Tri = 'sim' | 'nao' | '?'
export type Cond = 'bom' | 'razoavel' | 'mau' | 'obras' | '?'

export interface Floor { label: string; doors: string[] }

export interface Building {
  id: string
  street: string
  number: string
  corner_note: string | null
  lat: number | null
  lng: number | null
  floors: Floor[]
  construction: 'betao' | 'tabique' | 'misto' | '?'
  elevator: Tri
  garage: Tri
  storage: Tri
  storage_note: string | null
  ground_commerce: Tri
  commerce_desc: string | null
  porter: Tri
  mailbox: 'exterior' | 'interior' | '?'
  horizontal_property: Tri
  orientation: string
  cond_ext: Cond
  cond_int: Cond
  condo_admin: string | null
  notes: string | null
  origin: 'novo' | 'legado'
  /** Autocolante "publicidade não" (coluna de 21/10). */
  no_ads?: Tri
  created_at?: string
  updated_at?: string
}

export type CommercialStatus = 'nada' | 'fsbo' | 'fsba' | 'vendido' | 'arrendado' | 'vigilancia'

export interface Unit {
  id: string
  building_id: string
  label: string
  typology: string | null
  area_m2: number | null
  condition: Cond
  commercial_status: CommercialStatus
  pipedrive_deal_id: number | null
  notes: string | null
}

export interface Visit {
  id: string
  building_id: string
  visited_at: string
  year_uncertain: boolean
  companion: string | null
  general_note: string | null
  raw_text: string | null
  origin: 'novo' | 'legado'
}

export type Outcome =
  | 'nao_abriu' | 'caixa_cheia' | 'carta_mao' | 'carta_correio' | 'carta_porta'
  | 'postal' | 'bloco' | 'recusou' | 'falei'

/** Canal de entrega de uma peça de marketing. */
export type Channel = 'porta' | 'caixa' | 'mao' | '?'
/** Uma peça deixada numa porta: peça + canal, um só evento. */
export interface Delivery { piece: string; channel: Channel }

export interface Piece {
  id: string
  name: string
  short_name: string
  thumb: string | null
  active: boolean
  sort: number
}

export interface VisitResult {
  id: string
  visit_id: string
  unit_id: string
  /** Resultado (falei, recusou, nao_abriu, caixa_cheia). Os antigos carta/postal/bloco passaram a entregas a 21/10. */
  outcomes: Outcome[]
  /** Coluna de 21/10: pode faltar em dados lidos antes da migração. */
  deliveries?: Delivery[]
  note: string | null
}

export type Role = 'proprietario' | 'inquilino' | 'familiar' | 'empregada' | 'porteira' | 'administrador' | 'vizinho' | 'outro'

export interface Person {
  id: string
  name: string
  phone: string | null
  email: string | null
  traits: string | null
  notes: string | null
  pipedrive_person_id: number | null
}

export interface PersonUnit { person_id: string; unit_id: string; role: Role }

export interface Interaction {
  id: string
  person_id: string
  unit_id: string | null
  visit_id: string | null
  at: string
  notes: string | null
}

export interface UnitNote {
  id: string
  unit_id: string
  visit_id: string | null
  source: string | null
  text: string
  at: string
}

export interface Listing {
  id: string
  building_id: string
  unit_id: string | null
  floor_hint: string | null
  operation: 'venda' | 'arrendamento'
  first_seen: string
  first_seen_uncertain: boolean
  typology: string | null
  area_m2: number | null
  advertiser_type: 'particular' | 'agencia' | 'promotor' | '?'
  advertiser: string | null
  exclusivity: string | null
  url: string | null
  source: string | null
  active: boolean
  notes: string | null
  /** Quem atende o anúncio (dono num FSBO, agente num FSBA). Coluna acrescentada a 20/10. */
  contact_person_id?: string | null
  /** Estado de conservação dito no anúncio. Coluna acrescentada a 21/10. */
  condition?: Cond | null
  created_at?: string
}

export interface ListingPrice { id: string; listing_id: string; at: string; price: number }

export interface BuildingFull {
  building: Building
  units: Unit[]
  visits: Visit[]
  results: VisitResult[]
  listings: Listing[]
  prices: ListingPrice[]
  people: Person[]
  personUnits: PersonUnit[]
  interactions: Interaction[]
  unitNotes: UnitNote[]
}

export interface BuildingSummary {
  building: Building
  lastVisit: string | null
  /** Só anúncios de venda: o arrendamento não conta para "à venda", filtros nem cor do pino. */
  activeListings: number
  activeFsbo: number
  activeRentals: number
  /** Último anúncio inserido (sem o legado), para ordenar a lista. */
  lastListing: { at: string; source: string | null } | null
  visitCount: number
}
