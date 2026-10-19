import Reload from '../components/Reload'
import { useEffect, useMemo, useState } from 'react'
import MapView, { type Pin } from '../components/MapView'
import { listBuildings, norm } from '../data/store'
import type { BuildingSummary } from '../types'
import { fmtDate, go } from '../ui'

type Sort = 'visita' | 'criado' | 'rua' | 'perto'
const SORTS: [Sort, string][] = [['visita', 'Última visita'], ['criado', 'Mais recentes'], ['rua', 'Rua (A–Z)'], ['perto', 'Mais perto']]
const loadSort = (): Sort => { try { return (localStorage.getItem('ordem-predios') as Sort) || 'visita' } catch { return 'visita' } }
/** Distância aproximada em metros (suficiente para ordenar dentro do bairro). */
const dist = (a: { lat: number; lng: number }, lat: number | null, lng: number | null) =>
  lat == null || lng == null ? Infinity : Math.hypot((lat - a.lat) * 111_000, (lng - a.lng) * 87_000)

const SIX_MONTHS = 1000 * 60 * 60 * 24 * 182

function pinColor(s: BuildingSummary): string {
  if (s.activeListings) return '#a63a32'
  if (s.lastVisit && Date.now() - new Date(s.lastVisit).getTime() < SIX_MONTHS) return '#2f7d4f'
  if (s.lastVisit || s.building.origin === 'legado') return '#b26a00'
  return '#9c958a'
}

function summaryLine(s: BuildingSummary) {
  const n = s.building.floors.reduce((a, f) => a + f.doors.length, 0)
  const parts = [n ? `${n} frações` : 'grelha por definir']
  parts.push(s.lastVisit ? `última visita ${fmtDate(s.lastVisit)}` : 'sem visitas')
  if (s.activeListings) parts.push(`${s.activeListings} ${s.activeListings === 1 ? "anúncio ativo" : "anúncios ativos"}`)
  return parts.join(' · ')
}

/** Separa "correia teles 90" em rua e número. */
function splitAddress(q: string): { street: string; number: string } {
  const m = q.trim().match(/^(.*?)[\s,]+(\d+[a-zA-Z]?)\s*$/)
  const street = (m ? m[1] : q).trim()
  const pretty = street.replace(/\b\w/g, c => c.toUpperCase())
  return { street: /^(rua|r\.|av|avenida|praça|praca|largo|travessa)\b/i.test(pretty) ? pretty : `Rua ${pretty}`, number: m ? m[2] : '' }
}

export default function Home() {
  const [items, setItems] = useState<BuildingSummary[] | null>(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [locate, setLocate] = useState(0)
  const [sort, setSort] = useState<Sort>(loadSort)
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null)
  const [geoErr, setGeoErr] = useState('')
  const chooseSort = (v: Sort) => {
    setSort(v); try { localStorage.setItem('ordem-predios', v) } catch { /* ignora */ }
    if (v === 'perto' && !here) {
      setGeoErr('')
      navigator.geolocation?.getCurrentPosition(p => setHere({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => setGeoErr('Sem acesso à localização: autoriza-a no Safari para ordenar por distância.'), { enableHighAccuracy: true, timeout: 10000 })
    }
  }
  useEffect(() => { if (sort === 'perto') chooseSort('perto') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { listBuildings().then(setItems).catch(e => setErr(String(e.message ?? e))) }, [])

  const filtered = useMemo(() => {
    if (!items) return []
    const nq = norm(q)
    const list = nq ? items.filter(s => norm(`${s.building.street} ${s.building.number}`).includes(nq)) : items
    const byStreet = (a: BuildingSummary, b: BuildingSummary) =>
      a.building.street.localeCompare(b.building.street, 'pt') || a.building.number.localeCompare(b.building.number, 'pt', { numeric: true })
    const cmp: Record<Sort, (a: BuildingSummary, b: BuildingSummary) => number> = {
      visita: (a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? '') || byStreet(a, b),
      criado: (a, b) => (b.building.created_at ?? '').localeCompare(a.building.created_at ?? '') || byStreet(a, b),
      rua: byStreet,
      perto: (a, b) => here ? dist(here, a.building.lat, a.building.lng) - dist(here, b.building.lat, b.building.lng) || byStreet(a, b) : byStreet(a, b),
    }
    return [...list].sort(cmp[sort])
  }, [items, q, sort, here])

  const pins: Pin[] = useMemo(() => (items ?? []).filter(s => s.building.lat != null && s.building.lng != null).map(s => ({
    id: s.building.id, lat: s.building.lat!, lng: s.building.lng!, color: pinColor(s), label: s.building.number,
    title: `${s.building.street}, ${s.building.number}`,
  })), [items])

  const create = () => {
    const a = splitAddress(q)
    go(`/novo?street=${encodeURIComponent(a.street)}&number=${encodeURIComponent(a.number)}`)
  }

  return (
    <>
      <header className="top"><h1>Campo de Ourique</h1><button className="linkbtn" onClick={() => go('/novo')}>+ Prédio</button><Reload /></header>
      <main>
        <div className="search">🔎<input value={q} onChange={e => setQ(e.target.value)} placeholder="Rua e número, ex.: correia teles 90" autoCapitalize="off" autoCorrect="off" enterKeyHint="search" />{q && <button className="linkbtn" onClick={() => setQ('')}>✕</button>}</div>
        {q && (
          <div className="card">
            {filtered.slice(0, 8).map(s => (
              <div key={s.building.id} className="row click" onClick={() => go(`/p/${s.building.id}`)}>
                <div><b>{s.building.street}, {s.building.number}</b><div className="sub">{summaryLine(s)}</div></div>›
              </div>
            ))}
            {!filtered.length && <div className="sub">Sem registo para “{q}”.</div>}
            <div style={{ marginTop: 10 }}><button className="btn sec small" onClick={create}>+ Criar prédio “{splitAddress(q).street}{splitAddress(q).number ? ', ' + splitAddress(q).number : ''}”</button></div>
          </div>
        )}
        <MapView pins={pins} onPin={id => go(`/p/${id}`)} locateSignal={locate} />
        <div className="legend">
          <span><i className="dot" style={{ background: '#a63a32' }} />Anúncio ativo</span>
          <span><i className="dot" style={{ background: '#2f7d4f' }} />Visita &lt; 6 meses</span>
          <span><i className="dot" style={{ background: '#b26a00' }} />Visita antiga / legado</span>
          <span><i className="dot" style={{ background: '#9c958a' }} />Sem visitas</span>
          <button className="linkbtn" style={{ marginLeft: 'auto', fontSize: 13 }} onClick={() => setLocate(x => x + 1)}>📍 Onde estou</button>
        </div>
        {err && <div className="err">{err}</div>}
        {!q && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <h2 style={{ margin: 0 }}>Prédios ({items?.length ?? '…'})</h2>
              <select className="t" style={{ width: 'auto', padding: '6px 8px', fontSize: 14 }} aria-label="Ordenar prédios" value={sort} onChange={e => chooseSort(e.target.value as Sort)}>
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {geoErr && sort === 'perto' && <div className="sub">{geoErr}</div>}
            {filtered.map(s => (
              <div key={s.building.id} className="row click" onClick={() => go(`/p/${s.building.id}`)}>
                <div><b>{s.building.street}, {s.building.number}</b><div className="sub">{summaryLine(s)}</div></div>
                <i className="dot" style={{ background: pinColor(s) }} />
              </div>
            ))}
            {items && !items.length && <div className="sub">Ainda não há prédios. Pesquisa uma morada e cria o primeiro.</div>}
          </div>
        )}
      </main>
    </>
  )
}
