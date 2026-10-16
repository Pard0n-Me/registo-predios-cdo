import { useEffect, useState } from 'react'
import { getBuildingFull, saveListing } from '../data/store'
import type { BuildingFull, Listing } from '../types'
import { fmtDate, fmtPrice } from '../ui'

const today = () => new Date().toISOString().slice(0, 10)

export default function ListingForm({ buildingId, listingId, unitId }: { buildingId: string; listingId?: string; unitId?: string }) {
  const [f, setF] = useState<BuildingFull | null>(null)
  const [l, setL] = useState<Partial<Listing>>({
    building_id: buildingId, unit_id: unitId ?? null, operation: 'venda', first_seen: today(), first_seen_uncertain: false,
    advertiser_type: '?', active: true, source: 'radar',
  })
  const [price, setPrice] = useState('')
  const [priceAt, setPriceAt] = useState(today())
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getBuildingFull(buildingId).then(x => {
      setF(x)
      if (listingId) { const found = x.listings.find(y => y.id === listingId); if (found) setL(found) }
    }).catch(e => setErr(e.message))
  }, [buildingId, listingId])
  if (!f) return <main>{err ? <div className="err">{err}</div> : <div className="sub" style={{ padding: 20 }}>A carregar…</div>}</main>
  const set = <K extends keyof Listing>(k: K, v: Listing[K]) => setL(x => ({ ...x, [k]: v }))
  const prices = listingId ? f.prices.filter(p => p.listing_id === listingId).sort((a, b) => b.at.localeCompare(a.at)) : []

  const submit = async () => {
    setBusy(true); setErr('')
    try {
      const p = price ? +price.replace(/[^\d]/g, '') : null
      await saveListing({ ...l, building_id: buildingId, price: p, price_at: listingId ? priceAt : l.first_seen })
      location.replace(`#/p/${buildingId}`)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <>
      <header className="top"><button className="linkbtn" onClick={() => history.back()}>‹ Voltar</button><h1>{listingId ? 'Anúncio' : 'Novo anúncio'} · {f.building.street.replace(/^Rua /, 'R. ')}, {f.building.number}</h1></header>
      <main>
        <div className="card">
          <div className="two">
            <div><label className="f">Fração</label>
              <select className="t" value={l.unit_id ?? ''} onChange={e => set('unit_id', e.target.value || null)}>
                <option value="">Andar incerto</option>{f.units.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select></div>
            <div><label className="f">Operação</label>
              <select className="t" value={l.operation} onChange={e => set('operation', e.target.value as Listing['operation'])}><option value="venda">Venda</option><option value="arrendamento">Arrendamento</option></select></div>
          </div>
          {!l.unit_id && <><label className="f">O que se sabe do andar</label><input className="t" value={l.floor_hint ?? ''} placeholder="ex.: 3.º (?) Esq" onChange={e => set('floor_hint', e.target.value || null)} /></>}
          <div className="two">
            <div><label className="f">Tipologia</label><input className="t" value={l.typology ?? ''} placeholder="T2" onChange={e => set('typology', e.target.value || null)} /></div>
            <div><label className="f">Área (m²)</label><input className="t" inputMode="decimal" value={l.area_m2 ?? ''} onChange={e => set('area_m2', e.target.value ? +e.target.value.replace(',', '.') : null)} /></div>
          </div>
          <label className="f">Anunciante</label>
          <div className="seg">{([['particular', 'Particular (FSBO)'], ['agencia', 'Agência'], ['promotor', 'Promotor'], ['?', '?']] as const).map(([v, t]) =>
            <button key={v} className={'chip' + (l.advertiser_type === v ? ' on' : '')} onClick={() => set('advertiser_type', v)}>{t}</button>)}</div>
          {l.advertiser_type !== 'particular' && <input className="t" style={{ marginTop: 6 }} value={l.advertiser ?? ''} placeholder="Qual? ex.: KW, C21" onChange={e => set('advertiser', e.target.value || null)} />}
          <label className="f">Exclusividade</label><input className="t" value={l.exclusivity ?? ''} placeholder="sim / não / até quando" onChange={e => set('exclusivity', e.target.value || null)} />
          <label className="f">Link</label><input className="t" type="url" value={l.url ?? ''} onChange={e => set('url', e.target.value || null)} />
          <div className="two">
            <div><label className="f">Visto pela 1.ª vez</label><input className="t" type="date" value={l.first_seen} onChange={e => set('first_seen', e.target.value)} /></div>
            <div><label className="f">Fonte</label><input className="t" list="fontes" value={l.source ?? ''} onChange={e => set('source', e.target.value || null)} /></div>
          </div>
          <datalist id="fontes">{['radar', 'idealista', 'imovirtual', 'casa sapo', 'maxwork', 'placa na rua', 'vizinho'].map(s => <option key={s} value={s} />)}</datalist>
          <label className="f">Notas</label><textarea className="t" value={l.notes ?? ''} onChange={e => set('notes', e.target.value || null)} />
          {listingId && <div className="seg" style={{ marginTop: 10 }}>
            <button className={'chip' + (l.active ? ' on' : '')} onClick={() => set('active', true)}>Ativo</button>
            <button className={'chip' + (!l.active ? ' on' : '')} onClick={() => set('active', false)}>Retirado</button>
          </div>}
        </div>
        <div className="card">
          <h2>Preço</h2>
          {prices.map(p => <div className="row" key={p.id}><span className="sub">{fmtDate(p.at)}</span><span>{fmtPrice(p.price)}</span></div>)}
          <div className="two">
            <div><label className="f">{listingId ? 'Novo preço (€)' : 'Preço (€)'}</label><input className="t" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} placeholder="365000" /></div>
            {listingId && <div><label className="f">Data</label><input className="t" type="date" value={priceAt} onChange={e => setPriceAt(e.target.value)} /></div>}
          </div>
        </div>
        {err && <div className="err">{err}</div>}
      </main>
      <div className="fab"><button className="btn" disabled={busy} onClick={submit}>{busy ? 'A gravar…' : 'Gravar anúncio'}</button></div>
    </>
  )
}
