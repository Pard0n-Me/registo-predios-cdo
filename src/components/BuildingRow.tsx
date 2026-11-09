import Icon from './Icon'
import { STATE_ICON, STATE_TONE, addressText, detailLine, pinState, stateLine } from '../data/resumo'
import type { BuildingSummary } from '../types'
import { fmtPrice } from '../ui'

/** Um prédio como cartão: ícone de estado, morada, estado por escrito, detalhe e, se à venda, o preço do anúncio mais recente. */
export default function BuildingRow({ s, distanceText, onOpen }: { s: BuildingSummary; distanceText?: string; onOpen: () => void }) {
  const st = pinState(s)
  const price = s.adPrice != null ? fmtPrice(s.adPrice) : ''
  return (
    <div className="brow" role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}>
      <span className={'brow-ic ' + STATE_TONE[st]}><Icon name={STATE_ICON[st]} size={22} /></span>
      <span className="brow-t">{addressText(s.building)}</span>
      <span className="brow-s">{stateLine(s)}</span>
      <span className="brow-s">{detailLine(s)}</span>
      {(price || distanceText) && (
        <span className="brow-pr">
          {price && <span className="num">{price}</span>}
          {distanceText && <span className="sub num" style={{ fontWeight: 400, fontSize: 13 }}>{distanceText}</span>}
        </span>
      )}
    </div>
  )
}
