import { useEffect, useState } from 'react'
import Reload from '../components/Reload'
import { ADVERTISER, agoText, listActiveSaleAds, type AdRow } from '../data/anuncios'
import { fmtPrice, go } from '../ui'

export default function AnunciosPage() {
  const [rows, setRows] = useState<AdRow[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { listActiveSaleAds().then(setRows).catch(e => setErr(String(e.message ?? e))) }, [])
  const open = (id: string) => go(`/p/${id}`)
  return (
    <>
      <header className="top"><h1>Anúncios</h1><Reload /></header>
      <main>
        {err && <div className="err">{err} <button className="linkbtn" onClick={() => location.reload()}>Tentar outra vez</button></div>}
        {!rows && !err && <div className="sub">A carregar…</div>}
        {rows && !rows.length && <div className="card"><div className="sub">Sem anúncios de venda ativos.</div></div>}
        {rows && !!rows.length && (
          <div className="card">
            <h2>Anúncios de venda ativos ({rows.length})</h2>
            {rows.map(r => (
              <div key={r.listing.id} className="row click" role="button" tabIndex={0}
                onClick={() => open(r.buildingId)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(r.buildingId) } }}>
                <div>
                  <b>{r.street}, {r.number}</b>
                  <div className="sub">{[ADVERTISER[r.listing.advertiser_type], r.listing.typology, agoText(r.at)].filter(Boolean).join(' · ')}</div>
                </div>
                <b className="num">{r.price != null ? fmtPrice(r.price) : '—'}</b>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
