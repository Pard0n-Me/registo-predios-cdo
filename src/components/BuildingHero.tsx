import Icon from './Icon'
import { PIN_TEXT, STATE_ICON, STATE_TONE, pinState, plural, unitsCount, visitText } from '../data/resumo'
import { summarize } from '../data/store'
import type { BuildingFull } from '../types'
import { fmtPrice } from '../ui'

/** Resumo no topo da ficha: anúncios e preço (ou o estado), frações e visitas, etiquetas. */
export default function BuildingHero({ f }: { f: BuildingFull }) {
  const s = summarize(f.building, f.visits, f.listings, f.prices)
  const st = pinState(s)
  // Com um só anúncio, mostra-se a fração e as características dele.
  const ad = s.activeListings === 1 ? f.listings.find(l => l.active && l.operation === 'venda') : undefined
  const adUnit = ad ? (f.units.find(u => u.id === ad.unit_id)?.label ?? ad.floor_hint) : null
  const adChip = ad ? [adUnit, ad.typology, ad.area_m2 ? `${ad.area_m2} m²` : ''].filter(Boolean).join(' · ') : ''
  const big = s.activeListings
    ? `${plural(s.activeListings, 'anúncio', 'anúncios')}${s.adPrice != null ? ` · ${s.activeListings > 1 ? 'mais recente ' : ''}${fmtPrice(s.adPrice)}` : ''}`
    : PIN_TEXT[st]
  const n = unitsCount(s)
  const meta = [n ? plural(n, 'fração', 'frações') : '', visitText(s)].filter(Boolean).join(' · ')
  return (
    <div className="hero">
      <div className="hero-big">{big}</div>
      <div className="hero-meta">{meta.charAt(0).toUpperCase() + meta.slice(1)}</div>
      <div className="chips">
        <span className={'chip ' + STATE_TONE[st]}>
          <Icon name={STATE_ICON[st]} size={14} />{st === 'venda' ? `À venda · ${s.adFsbo ? 'FSBO' : 'FSBA'}` : PIN_TEXT[st]}
        </span>
        {adChip && <span className="chip acc">{adChip}</span>}
      </div>
    </div>
  )
}
