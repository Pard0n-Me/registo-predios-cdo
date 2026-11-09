// Leitura (sem escrita) dos anúncios de venda ativos, para o separador Anúncios.
import { db } from './adapter'
import type { Building, Listing, ListingPrice } from '../types'

export interface AdRow { listing: Listing; buildingId: string; street: string; number: string; price: number | null; at: string }

const lastPrice = (prices: ListingPrice[]): number | null =>
  [...prices].sort((a, b) => b.at.localeCompare(a.at))[0]?.price ?? null

/** Anúncios de venda ativos (sem o legado), do mais recente para o mais antigo. */
export async function listActiveSaleAds(): Promise<AdRow[]> {
  const [buildings, listings] = await Promise.all([db.all<Building>('buildings'), db.all<Listing>('listings')])
  const active = listings.filter(l => l.active && l.operation === 'venda' && l.source !== 'legado')
  const prices = await db.whereIn<ListingPrice>('listing_prices', 'listing_id', active.map(l => l.id))
  const byId = new Map(buildings.map(b => [b.id, b]))
  return active.flatMap(l => {
    const b = byId.get(l.building_id)
    if (!b) return []
    return [{ listing: l, buildingId: b.id, street: b.street, number: b.number,
      price: lastPrice(prices.filter(p => p.listing_id === l.id)), at: l.created_at ?? l.first_seen }]
  }).sort((x, y) => y.at.localeCompare(x.at))
}

export const ADVERTISER: Record<Listing['advertiser_type'], string> = { particular: 'Particular', agencia: 'Agência', promotor: 'Promotor', '?': 'Por saber' }
