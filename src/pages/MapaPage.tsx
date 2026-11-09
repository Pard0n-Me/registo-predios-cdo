import { useEffect, useMemo, useState } from 'react'
import BuildingCard from '../components/BuildingCard'
import BuildingRow from '../components/BuildingRow'
import Icon from '../components/Icon'
import MapView, { type MapViewState, type Pin } from '../components/MapView'
import { listBuildings, norm } from '../data/store'
import {
  PIN_COLORS, PIN_TEXT, SHOWS, loadShow, passesFilter, pinState, saveShow, splitAddress, addressText, visitedToday,
  type PinState, type Show,
} from '../data/resumo'
import type { BuildingSummary } from '../types'
import { go } from '../ui'

// Vista e prédio selecionado guardam-se só para a sessão (R18): ao voltar de um prédio, o mapa abre onde estava.
const VIEW_KEY = 'mapa-vista'
interface Saved { view: MapViewState | null; sel: string | null }
function loadSaved(): Saved {
  try { const raw = sessionStorage.getItem(VIEW_KEY); if (raw) return JSON.parse(raw) as Saved } catch { /* ignora */ }
  return { view: null, sel: null }
}
function saveSaved(p: Partial<Saved>) {
  try { sessionStorage.setItem(VIEW_KEY, JSON.stringify({ ...loadSaved(), ...p })) } catch { /* ignora */ }
}

const STATES: PinState[] = ['venda', 'recente', 'antiga', 'nunca']

function Mark({ st }: { st: PinState }) {
  return st === 'venda'
    ? <svg viewBox="-12 -30 24 34" width="18" height="24" aria-hidden="true"><path d="M0 3C0 3-10-5.5-10-12a10 10 0 0 1 20 0C10-5.5 0 3 0 3Z" fill={PIN_COLORS.venda} stroke="#fff" strokeWidth="2" /><circle cy="-12" r="3.5" fill="#fff" /></svg>
    : <i className="dot" style={{ background: PIN_COLORS[st], width: 12, height: 12 }} />
}

export default function MapaPage() {
  const [saved] = useState(loadSaved)
  const [items, setItems] = useState<BuildingSummary[] | null>(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [show, setShow] = useState<Show>(loadShow)
  const [locate, setLocate] = useState(0)
  const [selected, setSelected] = useState<string | null>(saved.sel)
  const [legend, setLegend] = useState(false)

  useEffect(() => { listBuildings().then(setItems).catch(e => setErr(String(e.message ?? e))) }, [])

  const select = (id: string | null) => { setSelected(id); saveSaved({ sel: id }) }
  // R11: se o prédio selecionado deixar de passar no filtro, o cartão fecha.
  const chooseShow = (v: Show) => {
    setShow(v); saveShow(v)
    const sel = selected && items?.find(s => s.building.id === selected)
    if (sel && !passesFilter(sel, v)) select(null)
  }

  const shown = useMemo(() => (items ?? []).filter(s => passesFilter(s, show)), [items, show])
  const pins: Pin[] = useMemo(() => shown.filter(s => s.building.lat != null && s.building.lng != null).map(s => {
    const st = pinState(s)
    const title = addressText(s.building)
    const today = visitedToday(s)
    return {
      id: s.building.id, lat: s.building.lat!, lng: s.building.lng!, color: PIN_COLORS[st], label: s.building.number, title,
      aria: `${title}, ${PIN_TEXT[st].toLowerCase()}${today ? ', visitado hoje' : ''}`, shape: (st === 'venda' ? 'venda' : 'dot') as Pin['shape'], today,
    }
  }), [shown])
  const noPos = shown.length - pins.length
  const current = selected ? shown.find(s => s.building.id === selected && s.building.lat != null) ?? null : null

  const results = useMemo(() => {
    const nq = norm(q)
    return nq ? (items ?? []).filter(s => norm(`${s.building.street} ${s.building.number}`).includes(nq)).filter(s => passesFilter(s, show)) : []
  }, [items, q, show])
  const create = () => {
    const a = splitAddress(q)
    go(`/novo?street=${encodeURIComponent(a.street)}&number=${encodeURIComponent(a.number)}`)
  }

  return (
    <div className="mapapage">
      <MapView fill adaptive pins={pins} selectedId={current?.building.id ?? null} locateSignal={locate}
        onPin={select} onMapTap={() => { select(null); setLegend(false) }}
        initialView={saved.view ?? undefined} onViewChange={v => saveSaved({ view: v })} />

      <div className="maptop">
        <div className="search"><Icon name="search" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Rua e número, ex.: correia teles 90" aria-label="Pesquisar prédio" autoCapitalize="off" autoCorrect="off" enterKeyHint="search" />{q && <button className="linkbtn iconbtn" aria-label="Limpar pesquisa" onClick={() => setQ('')}><Icon name="x" /></button>}</div>
        <div className="seg scroll-x" role="group" aria-label="Filtrar prédios">
          {SHOWS.map(([v, l]) => <button key={v} className={'chip filt mapchip' + (show === v ? ' on' : '')} aria-pressed={show === v} onClick={() => chooseShow(v)}>{l}</button>)}
        </div>
        {q && (
          <div className="results">
            {results.slice(0, 8).map(s => <BuildingRow key={s.building.id} s={s} onOpen={() => go(`/p/${s.building.id}`)} />)}
            {!results.length && <div className="card"><div className="sub">Sem registo para “{q}”.</div></div>}
            <div className="card"><button className="btn sec small" onClick={create}>+ Criar prédio “{splitAddress(q).street}{splitAddress(q).number ? ', ' + splitAddress(q).number : ''}”</button></div>
          </div>
        )}
        {err && <div className="err mapnote">{err} <button className="linkbtn" onClick={() => location.reload()}>Tentar outra vez</button></div>}
        {items && !!items.length && !shown.length && !q && <div className="mapnote">Nenhum prédio com este filtro.</div>}
        {noPos > 0 && !q && <div className="mapnote">{noPos} {noPos === 1 ? 'prédio sem posição no mapa' : 'prédios sem posição no mapa'} · <button className="linkbtn" onClick={() => go('/predios')}>ver na lista</button></div>}
      </div>

      {!q && <div className="mapctl">
        <button className="locate" aria-label="Onde estou" title="Onde estou" onClick={() => setLocate(x => x + 1)}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
        </button>
        <button className="locate" aria-label="Legenda" aria-expanded={legend} title="Legenda" onClick={() => setLegend(x => !x)}><Icon name="info" size={22} /></button>
        <button className="locate" aria-label="Recarregar" title="Recarregar" onClick={() => location.reload()}><Icon name="refresh" size={22} /></button>
      </div>}

      {legend && !q && (
        <div className="legendpanel" role="group" aria-label="Legenda do mapa">
          {STATES.map(st => <div key={st}><Mark st={st} /><span>{PIN_TEXT[st]}</span></div>)}
          <div><span className="legendcheck" aria-hidden="true"><Icon name="check" size={10} /></span><span>Visitado hoje</span></div>
        </div>
      )}

      {!current && !q && (
        <div className="mapbottom">
          <button className="mapfab sec" onClick={() => go('/predios')}><Icon name="list" size={20} />Lista</button>
          <button className="mapfab pri" onClick={() => go('/novo')}>+ Prédio</button>
        </div>
      )}

      {current && !q && <BuildingCard s={current} onClose={() => select(null)} />}
    </div>
  )
}
