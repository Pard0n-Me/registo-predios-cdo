import Reload from '../components/Reload'
import { useEffect, useState } from 'react'
import { addUnitNote, getBuildingFull, updateUnit } from '../data/store'
import type { BuildingFull, CommercialStatus, Cond, Unit } from '../types'
import { COND, STATUS, fmtDate, fmtDateTime, fmtPrice, go, outcomeLabel, roleLabel } from '../ui'

export default function UnitPage({ buildingId, unitId }: { buildingId: string; unitId: string }) {
  const [f, setF] = useState<BuildingFull | null>(null)
  const [u, setU] = useState<Unit | null>(null)
  const [dirty, setDirty] = useState(false)
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const load = () => getBuildingFull(buildingId).then(x => { setF(x); setU(x.units.find(y => y.id === unitId) ?? null) }).catch(e => setErr(e.message))
  useEffect(() => { load() }, [buildingId, unitId]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!f || !u) return <main>{err ? <div className="err">{err}</div> : <div className="sub" style={{ padding: 20 }}>A carregar…</div>}</main>

  const set = <K extends keyof Unit>(k: K, v: Unit[K]) => { setU({ ...u, [k]: v }); setDirty(true) }
  const save = async () => {
    try {
      await updateUnit(u.id, { typology: u.typology, area_m2: u.area_m2, condition: u.condition, commercial_status: u.commercial_status, pipedrive_deal_id: u.pipedrive_deal_id, notes: u.notes })
      setDirty(false)
    } catch (e) { setErr((e as Error).message) }
  }
  const addNote = async () => { if (!note.trim()) return; await addUnitNote(u.id, note.trim(), null); setNote(''); load() }

  const people = f.personUnits.filter(pu => pu.unit_id === u.id).map(pu => ({ pu, p: f.people.find(p => p.id === pu.person_id) })).filter(x => x.p)
  const listings = f.listings.filter(l => l.unit_id === u.id)
  const history = f.visits.map(v => ({ v, r: f.results.find(r => r.visit_id === v.id && r.unit_id === u.id) })).filter(x => x.r)
  const notes = f.unitNotes.filter(n => n.unit_id === u.id).sort((a, b) => b.at.localeCompare(a.at))

  return (
    <>
      <header className="top"><button className="linkbtn" onClick={() => go(`/p/${buildingId}`)}>‹ Prédio</button><h1>{f.building.street.replace(/^Rua /, 'R. ')}, {f.building.number} · {u.label}</h1><Reload /></header>
      <main>
        <div className="card">
          <div className="two">
            <div><label className="f">Tipologia</label><input className="t" value={u.typology ?? ''} placeholder="T2" onChange={e => set('typology', e.target.value || null)} /></div>
            <div><label className="f">Área (m²)</label><input className="t" inputMode="decimal" value={u.area_m2 ?? ''} onChange={e => set('area_m2', e.target.value ? +e.target.value.replace(',', '.') : null)} /></div>
          </div>
          <div className="two">
            <div><label className="f">Conservação</label><select className="t" value={u.condition} onChange={e => set('condition', e.target.value as Cond)}>{COND.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select></div>
            <div><label className="f">Estado comercial</label><select className="t" value={u.commercial_status} onChange={e => set('commercial_status', e.target.value as CommercialStatus)}>{STATUS.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select></div>
          </div>
          <label className="f">Negócio no Pipedrive (ID)</label><input className="t" inputMode="numeric" value={u.pipedrive_deal_id ?? ''} onChange={e => set('pipedrive_deal_id', e.target.value ? +e.target.value : null)} />
          <label className="f">Notas</label><textarea className="t" value={u.notes ?? ''} onChange={e => set('notes', e.target.value || null)} />
          {dirty && <button className="btn" style={{ width: '100%', marginTop: 10 }} onClick={save}>Gravar fração</button>}
          {err && <div className="err">{err}</div>}
        </div>

        <div className="card">
          <h2>Pessoas</h2>
          {!people.length && <div className="sub">Ninguém registado.</div>}
          {people.map(({ pu, p }) => (
            <div key={p!.id} className="row click" onClick={() => go(`/pessoa/${p!.id}`)}>
              <div><b>{p!.name}</b> <span className="sub">· {roleLabel(pu.role)}</span>
                <div className="sub">{[p!.phone, p!.traits].filter(Boolean).join(' · ')}</div></div>
              {p!.phone ? <a href={`tel:${p!.phone}`} onClick={e => e.stopPropagation()}>📞</a> : '›'}
            </div>
          ))}
        </div>

        <div className="card">
          <h2>Anúncios</h2>
          {!listings.length && <div className="sub">Nenhum.</div>}
          {listings.map(l => {
            const p = f.prices.filter(x => x.listing_id === l.id).sort((a, b) => b.at.localeCompare(a.at))[0]
            return <div key={l.id} className="row click" onClick={() => go(`/p/${buildingId}/anuncio/${l.id}`)}>
              <div>{fmtDate(l.first_seen, l.first_seen_uncertain)} · {l.operation} · {l.advertiser_type === 'particular' ? 'FSBO' : l.advertiser ?? '?'}{p ? ` · ${fmtPrice(p.price)}` : ''}<div className="sub">{l.active ? 'ativo' : 'retirado'}</div></div>›
            </div>
          })}
          <button className="linkbtn" onClick={() => go(`/p/${buildingId}/anuncio?unit=${u.id}`)}>+ anúncio nesta fração</button>
        </div>

        <div className="card">
          <h2>O que se sabe (notas e terceiros)</h2>
          {notes.map(n => <div key={n.id} className="row" style={{ display: 'block' }}><span className="sub">{fmtDate(n.at)}{n.source ? ` · ${n.source}` : ''}</span><div>{n.text}</div></div>)}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><input className="t" value={note} onChange={e => setNote(e.target.value)} placeholder="Acrescentar nota" /><button className="btn small" onClick={addNote}>+</button></div>
        </div>

        <div className="card">
          <h2>Histórico de portas</h2>
          {!history.length && <div className="sub">Sem visitas a esta fração.</div>}
          {history.map(({ v, r }) => <div key={v.id} className="row" style={{ display: 'block' }}>
            <span className="sub">{v.year_uncertain ? fmtDate(v.visited_at, true) : fmtDateTime(v.visited_at)}{v.companion ? ` · com ${v.companion}` : ''}</span>
            <div>{r!.outcomes.map(outcomeLabel).join(' + ')}{r!.note ? ` · ${r!.note}` : ''}</div>
            {f.interactions.filter(i => i.visit_id === v.id && i.unit_id === u.id).map(i => <div key={i.id} className="sub">👤 {f.people.find(p => p.id === i.person_id)?.name}: {i.notes ?? '—'}</div>)}
          </div>)}
        </div>
      </main>
    </>
  )
}
