import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon'
import Reload from '../components/Reload'
import { listBuildings, norm } from '../data/store'
import {
  SHOWS, SORTS, distance, fmtDistance, loadShow, loadSort, passesFilter, pinColor, saveShow, saveSort,
  sortBuildings, splitAddress, summaryLine, type Show, type Sort,
} from '../data/resumo'
import type { BuildingSummary } from '../types'
import { go } from '../ui'

export default function PrediosPage() {
  const [items, setItems] = useState<BuildingSummary[] | null>(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [show, setShow] = useState<Show>(loadShow)
  const [sort, setSort] = useState<Sort>(loadSort)
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null)
  const [geoErr, setGeoErr] = useState('')

  useEffect(() => { listBuildings().then(setItems).catch(e => setErr(String(e.message ?? e))) }, [])

  // A localização só se pede quando o António a pede (R13): nunca ao abrir a página.
  const askLocation = () => {
    setGeoErr('')
    if (!navigator.geolocation) { setGeoErr('Este aparelho não dá a localização.'); return }
    navigator.geolocation.getCurrentPosition(p => setHere({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setGeoErr('Sem acesso à localização: autoriza-a no Safari para ordenar por distância.'), { enableHighAccuracy: true, timeout: 10000 })
  }
  const chooseSort = (v: Sort) => { setSort(v); saveSort(v); if (v === 'perto' && !here) askLocation() }
  const chooseShow = (v: Show) => { setShow(v); saveShow(v) }
  const nearPending = sort === 'perto' && !here
  const effective: Sort = nearPending ? 'visita' : sort

  const filtered = useMemo(() => {
    if (!items) return []
    const nq = norm(q)
    const list = (nq ? items.filter(s => norm(`${s.building.street} ${s.building.number}`).includes(nq)) : items).filter(s => passesFilter(s, show))
    return sortBuildings(list, effective, here)
  }, [items, q, show, effective, here])

  const create = () => {
    const a = splitAddress(q)
    go(`/novo?street=${encodeURIComponent(a.street)}&number=${encodeURIComponent(a.number)}`)
  }
  const open = (id: string) => go(`/p/${id}`)

  return (
    <>
      <header className="top"><h1>Prédios</h1><button className="linkbtn" onClick={() => go('/novo')}>+ Prédio</button><Reload /></header>
      <main>
        <div className="search"><Icon name="search" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Rua e número, ex.: correia teles 90" aria-label="Pesquisar prédio" autoCapitalize="off" autoCorrect="off" enterKeyHint="search" />{q && <button className="linkbtn iconbtn" aria-label="Limpar pesquisa" onClick={() => setQ('')}><Icon name="x" /></button>}</div>
        {err && <div className="err">{err} <button className="linkbtn" onClick={() => location.reload()}>Tentar outra vez</button></div>}
        {q ? (
          <div className="card">
            {filtered.slice(0, 8).map(s => (
              <div key={s.building.id} className="row click" role="button" tabIndex={0} onClick={() => open(s.building.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(s.building.id) } }}>
                <div><b>{s.building.street}, {s.building.number}</b><div className="sub">{summaryLine(s)}</div></div>›
              </div>
            ))}
            {!filtered.length && <div className="sub">Sem registo para “{q}”.</div>}
            <div style={{ marginTop: 10 }}><button className="btn sec small" onClick={create}>+ Criar prédio “{splitAddress(q).street}{splitAddress(q).number ? ', ' + splitAddress(q).number : ''}”</button></div>
          </div>
        ) : (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <h2 style={{ margin: 0 }}>Prédios ({items?.length ?? '…'})</h2>
              <select className="t" style={{ width: 'auto', padding: '6px 8px', fontSize: 14 }} aria-label="Ordenar prédios" value={sort} onChange={e => chooseSort(e.target.value as Sort)}>
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="seg scroll-x" role="group" aria-label="Filtrar prédios" style={{ marginBottom: 4 }}>
              {SHOWS.map(([v, l]) => <button key={v} className={'chip filt' + (show === v ? ' on' : '')} aria-pressed={show === v} onClick={() => chooseShow(v)}>{l}</button>)}
            </div>
            {nearPending && <div className="sub">A ordem "Mais perto" precisa da tua localização. <button className="linkbtn" onClick={askLocation}>Usar a minha localização</button></div>}
            {geoErr && <div className="sub">{geoErr}</div>}
            {items && !!items.length && !filtered.length && <div className="sub" style={{ marginTop: 8 }}>Nenhum prédio com este filtro.</div>}
            {filtered.map(s => (
              <div key={s.building.id} className="row click" role="button" tabIndex={0} onClick={() => open(s.building.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(s.building.id) } }}>
                <div><b>{s.building.street}, {s.building.number}</b><div className="sub">{summaryLine(s)}</div></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {here && sort === 'perto' && <span className="sub num">{fmtDistance(distance(here, s.building.lat, s.building.lng))}</span>}
                  <i className="dot" style={{ background: pinColor(s) }} />
                </div>
              </div>
            ))}
            {items && !items.length && <div className="sub">Ainda não há prédios. Pesquisa uma morada e cria o primeiro.</div>}
          </div>
        )}
      </main>
    </>
  )
}
