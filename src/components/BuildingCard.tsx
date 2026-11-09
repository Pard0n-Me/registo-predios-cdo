import Icon from './Icon'
import { STATE_ICON, STATE_TONE, addressText, detailLine, pinState, stateLine } from '../data/resumo'
import type { BuildingSummary } from '../types'
import { fmtPrice, go } from '../ui'

export default function BuildingCard({ s, onClose }: { s: BuildingSummary; onClose: () => void }) {
  const id = s.building.id
  const st = pinState(s)
  const title = addressText(s.building)

  return (
    <section className="bcard" aria-label={`Prédio selecionado: ${title}`}>
      <div className="bcard-h">
        <h3>{title}</h3>
        <button className="linkbtn iconbtn" aria-label="Fechar cartão" onClick={onClose}><Icon name="x" size={22} /></button>
      </div>
      <div className="bcard-row">
        <span className={'chip ' + STATE_TONE[st]}><Icon name={STATE_ICON[st]} size={14} />{stateLine(s)}</span>
        {s.adPrice != null && <b className="bprice">{fmtPrice(s.adPrice)}</b>}
      </div>
      <div className="sub">{detailLine(s)}</div>
      <div className="bcard-btns">
        <button className="btn tonal" onClick={() => go(`/p/${id}`)}>Abrir prédio</button>
        <button className="btn" onClick={() => go(`/p/${id}/visita`)}>Nova visita</button>
      </div>
    </section>
  )
}
