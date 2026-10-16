import { useEffect, useMemo, useState } from 'react'
import MapView, { type Pin } from '../components/MapView'
import { listBuildings, norm } from '../data/store'
import type { BuildingSummary } from '../types'
import { fmtDate, go } from '../ui'

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

  useEffect(() => { listBuildings().then(setItems).catch(e => setErr(String(e.message ?? e))) }, [])

  const filtered = useMemo(() => {
    if (!items) return []
    const nq = norm(q)
    const list = nq ? items.filter(s => norm(`${s.building.street} ${s.building.number}`).includes(nq)) : items
    return [...list].sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? '') || a.building.street.localeCompare(b.building.street))
  }, [items, q])

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
      <header className="top"><h1>Campo de Ourique</h1><button className="linkbtn" onClick={() => go('/novo')}>+ Prédio</button></header>
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
            <h2>Prédios ({items?.length ?? '…'})</h2>
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
