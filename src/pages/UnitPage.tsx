import { flash } from '../components/Toast'
import Icon from '../components/Icon'
import Reload from '../components/Reload'
import { useEffect, useState } from 'react'
import { addPersonToUnit, addUnitNote, deleteEmptyUnit, getBuildingFull, mergeUnit, searchPeople, unitLabel, updateUnit } from '../data/store'
import type { BuildingFull, CommercialStatus, Cond, Person, Role, Unit } from '../types'
import { COND, ROLES, STATUS, fmtDate, fmtDateTime, fmtPrice, go, resultText, roleLabel } from '../ui'
import { usePieces } from '../data/pieces'

export default function UnitPage({ buildingId, unitId }: { buildingId: string; unitId: string }) {
  const pieces = usePieces()
  const [f, setF] = useState<BuildingFull | null>(null)
  const [u, setU] = useState<Unit | null>(null)
  const [dirty, setDirty] = useState(false)
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [target, setTarget] = useState('')
  const [confirmMerge, setConfirmMerge] = useState(false)
  const [busy, setBusy] = useState(false)
  const EMPTY_P = { name: '', role: 'proprietario' as Role, phone: '', email: '', traits: '', notes: '' }
  const [adding, setAdding] = useState(false)
  const [np, setNp] = useState(EMPTY_P)
  const [matches, setMatches] = useState<Person[]>([])
  const setName = async (name: string) => { setNp(x => ({ ...x, name })); setMatches(name.trim().length >= 2 ? (await searchPeople(name)).slice(0, 3) : []) }
  const load = () => getBuildingFull(buildingId).then(x => { setF(x); setU(x.units.find(y => y.id === unitId) ?? null) }).catch(e => setErr(e.message))
  useEffect(() => { load() }, [buildingId, unitId]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!f || !u) return <main>{err ? <div className="err">{err}</div> : <div className="sub" style={{ padding: 20 }}>A carregar…</div>}</main>

  const set = <K extends keyof Unit>(k: K, v: Unit[K]) => { setU({ ...u, [k]: v }); setDirty(true) }
  const save = async () => {
    try {
      await updateUnit(u.id, { typology: u.typology, area_m2: u.area_m2, condition: u.condition, commercial_status: u.commercial_status, pipedrive_deal_id: u.pipedrive_deal_id, notes: u.notes })
      setDirty(false); flash('Fração gravada')
    } catch (e) { setErr((e as Error).message) }
  }
  const addNote = async () => { if (!note.trim()) return; await addUnitNote(u.id, note.trim(), null); setNote(''); load() }

  const people = f.personUnits.filter(pu => pu.unit_id === u.id).map(pu => ({ pu, p: f.people.find(p => p.id === pu.person_id) })).filter(x => x.p)
  const listings = f.listings.filter(l => l.unit_id === u.id)
  const history = f.visits.map(v => ({ v, r: f.results.find(r => r.visit_id === v.id && r.unit_id === u.id) })).filter(x => x.r)
  const notes = f.unitNotes.filter(n => n.unit_id === u.id).sort((a, b) => b.at.localeCompare(a.at))
  const gridLabels = f.building.floors.flatMap(fl => fl.doors.map(d => unitLabel(fl.label, d)))
  const outside = !gridLabels.includes(u.label)
  const gridUnits = f.units.filter(x => x.id !== u.id && gridLabels.includes(x.label)).sort((a, b) => gridLabels.indexOf(a.label) - gridLabels.indexOf(b.label))
  // sugere as frações do mesmo piso (ex.: "2.º" → "2.º Esq" e "2.º Dto")
  const samefloor = gridUnits.filter(x => x.label.startsWith(u.label + ' '))
  const isEmpty = !listings.length && !history.length && !people.length && !notes.length
  const merge = async () => {
    setBusy(true); setErr('')
    try { await mergeUnit(u.id, target); flash('Frações juntas'); location.replace(`#/p/${buildingId}/f/${target}`) }
    catch (e) { setErr((e as Error).message); setBusy(false) }
  }
  const removeEmpty = async () => {
    setBusy(true); setErr('')
    try { await deleteEmptyUnit(u.id); flash('Fração apagada'); location.replace(`#/p/${buildingId}`) }
    catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  return (
    <>
      <header className="top"><button className="linkbtn" onClick={() => go(`/p/${buildingId}`)}>‹ Prédio</button><h1>{f.building.street.replace(/^Rua /, 'R. ')}, {f.building.number} · {u.label}</h1><Reload /></header>
      <main>
        {outside && (
          <div className="card" style={{ borderLeft: '4px solid var(--warn)' }}>
            <b>Esta fração não está na grelha do prédio.</b>
            <div className="sub" style={{ marginTop: 4 }}>
              {isEmpty ? 'Não tem registos: podes apagá-la.' : 'Se for uma das frações da grelha (ex.: o 2.º de um anúncio que afinal é o 2.º Esq), junta-a: anúncios, visitas, pessoas e notas passam para lá.'}
            </div>
            {!!gridUnits.length && !isEmpty && <>
              <label className="f" htmlFor="merge-target">Juntar a</label>
              <select id="merge-target" className="t" value={target} onChange={e => { setTarget(e.target.value); setConfirmMerge(false) }}>
                <option value="">Escolhe a fração…</option>
                {samefloor.length > 0 && <optgroup label="Mesmo piso">{samefloor.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</optgroup>}
                <optgroup label="Todas">{gridUnits.filter(x => !samefloor.includes(x)).map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</optgroup>
              </select>
              {target && !confirmMerge && <button className="btn" style={{ width: '100%', marginTop: 10 }} onClick={() => setConfirmMerge(true)}>Juntar ao {f.units.find(x => x.id === target)?.label}</button>}
              {target && confirmMerge && <div className="note" style={{ marginTop: 10 }}>
                <b>Juntar "{u.label}" ao {f.units.find(x => x.id === target)?.label}?</b> Tudo o que está aqui passa para lá e "{u.label}" desaparece.
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="btn sec" disabled={busy} onClick={() => setConfirmMerge(false)}>Cancelar</button>
                  <button className="btn" disabled={busy} onClick={merge}>{busy ? 'A juntar…' : 'Juntar'}</button>
                </div>
              </div>}
            </>}
            {isEmpty && <button className="btn sec" style={{ width: '100%', marginTop: 10 }} disabled={busy} onClick={removeEmpty}>Apagar esta fração</button>}
          </div>
        )}
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
          {!people.length && !adding && <div className="sub">Ninguém registado.</div>}
          {people.map(({ pu, p }) => (
            <div key={p!.id} className="row click" onClick={() => go(`/pessoa/${p!.id}`)}>
              <div><b>{p!.name}</b> <span className="sub">· {roleLabel(pu.role)}</span>
                <div className="sub">{[p!.phone, p!.traits].filter(Boolean).join(' · ')}</div></div>
              {p!.phone ? <a className="iconbtn" aria-label={`Ligar a ${p!.name}`} href={`tel:${p!.phone}`} onClick={e => e.stopPropagation()}><Icon name="phone" /></a> : '›'}
            </div>
          ))}
          {!adding && <button className="linkbtn" style={{ marginTop: 8 }} onClick={() => { setAdding(true); setNp(EMPTY_P); setMatches([]) }}>+ Pessoa</button>}
          {adding && <div style={{ marginTop: 8 }}>
            <div className="sub">Sem visita: para quem conheces por outra via (placa de venda, anúncio, vizinho). Se falaste à porta, regista antes uma visita.</div>
            <label className="f" htmlFor="np-name">Nome</label>
            <input id="np-name" className="t" value={np.name} onChange={e => setName(e.target.value)} placeholder="Nome (ou descrição, ex.: dono da loja)" autoComplete="off" />
            {matches.filter(m => !people.some(x => x.p!.id === m.id)).map(m => (
              <div key={m.id} className="row" style={{ padding: '8px 0' }}>
                <div><b>{m.name}</b><div className="sub">{[m.phone, m.traits].filter(Boolean).join(' · ') || 'já registada'}</div></div>
                <button className="btn sec small" disabled={busy} onClick={async () => { setBusy(true); try { await addPersonToUnit(u.id, { existingId: m.id, name: m.name, role: np.role }); flash('Pessoa ligada'); setAdding(false); load() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) } }}>Ligar esta</button>
              </div>
            ))}
            <label className="f" htmlFor="np-role">Papel</label>
            <select id="np-role" className="t" value={np.role} onChange={e => setNp({ ...np, role: e.target.value as Role })}>{ROLES.map(([r, l]) => <option key={r} value={r}>{l}</option>)}</select>
            <div className="two">
              <div><label className="f" htmlFor="np-phone">Telefone</label><input id="np-phone" className="t" type="tel" value={np.phone} onChange={e => setNp({ ...np, phone: e.target.value })} /></div>
              <div><label className="f" htmlFor="np-email">Email</label><input id="np-email" className="t" type="email" value={np.email} onChange={e => setNp({ ...np, email: e.target.value })} /></div>
            </div>
            <label className="f" htmlFor="np-traits">Traços para reconhecer</label><input id="np-traits" className="t" value={np.traits} onChange={e => setNp({ ...np, traits: e.target.value })} />
            <label className="f" htmlFor="np-notes">Notas (de onde vem o contacto)</label><textarea id="np-notes" className="t" value={np.notes} onChange={e => setNp({ ...np, notes: e.target.value })} placeholder="ex.: placa de venda na montra, 20/10; 2.º número do Idealista" />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn sec" disabled={busy} onClick={() => setAdding(false)}>Cancelar</button>
              <button className="btn" disabled={busy || !np.name.trim()} onClick={async () => {
                setBusy(true)
                try { await addPersonToUnit(u.id, np); flash('Pessoa acrescentada'); setAdding(false); load() }
                catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
              }}>{busy ? 'A gravar…' : 'Gravar pessoa'}</button>
            </div>
          </div>}
        </div>

        <div className="card">
          <h2>Anúncios</h2>
          {!listings.length && <div className="sub">Nenhum.</div>}
          {listings.map(l => {
            const p = f.prices.filter(x => x.listing_id === l.id).sort((a, b) => b.at.localeCompare(a.at))[0]
            return <div key={l.id} className="row click" onClick={() => go(`/p/${buildingId}/anuncio/${l.id}`)}>
              <div>{fmtDate(l.first_seen, l.first_seen_uncertain)} · {l.operation} · {l.advertiser_type === 'particular' ? 'FSBO' : l.advertiser ?? '?'}{p ? ` · ${fmtPrice(p.price)}` : ''}<div className="sub">{l.active ? 'ativo' : 'retirado'}{(() => { const c = f.people.find(x => x.id === l.contact_person_id); return c ? ` · contacto: ${c.name}${c.phone ? ' ' + c.phone : ''}` : '' })()}</div></div>›
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
            <div>{resultText(r!, pieces)}{r!.note ? ` · ${r!.note}` : ''}</div>
            {f.interactions.filter(i => i.visit_id === v.id && i.unit_id === u.id).map(i => <div key={i.id} className="sub"><Icon name="user" size={13} /> {f.people.find(p => p.id === i.person_id)?.name}: {i.notes ?? '—'}</div>)}
          </div>)}
        </div>
      </main>
    </>
  )
}
