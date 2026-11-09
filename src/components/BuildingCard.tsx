import { useEffect, useState } from 'react'
import Icon from './Icon'
import { PIN_TEXT, pinState, visitedToday, type PinState } from '../data/resumo'
import { latestSalePrice } from '../data/anuncios'
import type { BuildingSummary } from '../types'
import { fmtDate, fmtPrice, go } from '../ui'

const CHIP: Record<PinState, string> = { venda: 'bad', recente: 'ok', antiga: 'warn', nunca: '' }
const ICON: Record<PinState, 'tag' | 'check' | 'clock' | 'minus'> = { venda: 'tag', recente: 'check', antiga: 'clock', nunca: 'minus' }

export default function BuildingCard({ s, onClose }: { s: BuildingSummary; onClose: () => void }) {
  const id = s.building.id
  const st = pinState(s)
  const [found, setFound] = useState<{ id: string; price: number | null } | null>(null)
  // Só vale o preço lido para este prédio: ao mudar de prédio, o anterior deixa de contar.
  const price = found?.id === id ? found.price : null

  useEffect(() => {
    if (!s.activeListings) return
    let alive = true
    // O preço é um extra: se falhar, o cartão continua válido sem ele.
    latestSalePrice(id).then(p => { if (alive) setFound({ id, price: p }) }).catch(() => undefined)
    return () => { alive = false }
  }, [id, s.activeListings])

  const ads = s.activeListings
    ? `${s.activeListings} ${s.activeListings === 1 ? 'anúncio de venda' : 'anúncios de venda'}${s.activeFsbo ? ` · ${s.activeFsbo} FSBO` : ''}`
    : ''
  const visit = visitedToday(s) ? 'Visitado hoje' : s.lastVisit ? `Última visita ${fmtDate(s.lastVisit)}` : 'Sem visitas'

  return (
    <section className="bcard" aria-label={`Prédio selecionado: ${s.building.street}, ${s.building.number}`}>
      <div className="bcard-h">
        <h3>{s.building.street}, {s.building.number}</h3>
        <button className="linkbtn iconbtn" aria-label="Fechar cartão" onClick={onClose}><Icon name="x" size={22} /></button>
      </div>
      <div className="bcard-row">
        <span className={'chip ' + CHIP[st]}><Icon name={ICON[st]} size={14} />{PIN_TEXT[st]}</span>
        {price != null && <b className="bprice">{fmtPrice(price)}</b>}
      </div>
      <div className="sub">{[ads, visit].filter(Boolean).join(' · ')}</div>
      <div className="bcard-btns">
        <button className="btn sec" onClick={() => go(`/p/${id}`)}>Abrir prédio</button>
        <button className="btn" onClick={() => go(`/p/${id}/visita`)}>Nova visita</button>
      </div>
    </section>
  )
}
