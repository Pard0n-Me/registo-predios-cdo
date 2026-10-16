import { useEffect, useMemo, useState } from 'react'
import { getBuildingFull, saveVisit, unitLabel, type ResultInput } from '../data/store'
import type { BuildingFull, Outcome, Person, Role } from '../types'
import { COMPANIONS, OUTCOMES, ROLES, cellClass, outcomeLabel, toLocalInput } from '../ui'

interface Draft { visitedAt: string; companion: string | null; generalNote: string; results: Record<string, ResultInput> }
const draftKey = (id: string) => `visita-rascunho-${id}`
const loadDraft = (id: string): Draft | null => { try { const r = localStorage.getItem(draftKey(id)); return r ? JSON.parse(r) : null } catch { return null } }

export default function VisitPage({ id }: { id: string }) {
  const [f, setF] = useState<BuildingFull | null>(null)
  const [d, setD] = useState<Draft>(() => loadDraft(id) ?? { visitedAt: toLocalInput(), companion: null, generalNote: '', results: {} })
  const [restored] = useState(() => !!loadDraft(id))
  const [editing, setEditing] = useState<string | null>(null)
  const [other, setOther] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { getBuildingFull(id).then(setF).catch(e => setErr(e.message)) }, [id])
  useEffect(() => { try { localStorage.setItem(draftKey(id), JSON.stringify(d)) } catch { /* sem armazenamento */ } }, [d, id])

  const unitBy = useMemo(() => new Map((f?.units ?? []).map(u => [u.label, u])), [f])
  if (!f) return <main>{err ? <div className="err">{err}</div> : <div className="sub" style={{ padding: 20 }}>A carregar…</div>}</main>
  const b = f.building
  const count = Object.values(d.results).filter(r => r.outcomes.length || r.note).length

  const save = async () => {
    setBusy(true); setErr('')
    try {
      await saveVisit({ buildingId: id, visitedAt: new Date(d.visitedAt).toISOString(), companion: d.companion, generalNote: d.generalNote, results: Object.values(d.results) })
      try { localStorage.removeItem(draftKey(id)) } catch { /* ignora */ }
      location.replace(`#/p/${id}`)
    } catch (e) { setErr((e as Error).message + ' · O rascunho continua guardado no telefone.') } finally { setBusy(false) }
  }
  const discard = () => { if (confirm('Apagar este rascunho de visita?')) { try { localStorage.removeItem(draftKey(id)) } catch { /* ignora */ } location.replace(`#/p/${id}`) } }

  return (
    <>
      <header className="top"><button className="linkbtn" onClick={() => history.back()}>‹ Prédio</button><h1>Visita · {b.street.replace(/^Rua /, 'R. ')}, {b.number}</h1></header>
      <main>
        {restored && <div className="note">Rascunho recuperado deste telefone. <button className="linkbtn" onClick={discard}>Apagar</button></div>}
        <div className="card">
          <h2>Acompanhante</h2>
          <div className="seg">
            <button className={'chip' + (d.companion === null ? ' on' : '')} onClick={() => setD({ ...d, companion: null })}>Sozinho</button>
            {COMPANIONS.map(c => <button key={c} className={'chip' + (d.companion === c ? ' on' : '')} onClick={() => setD({ ...d, companion: c })}>{c}</button>)}
            {other || (d.companion && !COMPANIONS.includes(d.companion))
              ? <input className="t" style={{ width: 140 }} placeholder="Nome" value={d.companion && !COMPANIONS.includes(d.companion) ? d.companion : other} onChange={e => { setOther(e.target.value); setD({ ...d, companion: e.target.value || null }) }} />
              : <button className="chip" onClick={() => setOther(' ')}>+ outro</button>}
          </div>
          <label className="f">Data e hora</label>
          <input className="t" type="datetime-local" value={d.visitedAt} onChange={e => setD({ ...d, visitedAt: e.target.value })} />
        </div>
        <div className="card">
          <h2>Toca numa fração</h2>
          {!b.floors.length && <div className="sub">Este prédio ainda não tem grelha. <a href={`#/p/${id}/editar`}>Definir pisos e frações</a></div>}
          <div className="grid">
            {b.floors.map(fl => (
              <div className="floor" key={fl.label}>
                <div className="floor-label">{fl.label}</div>
                <div className="units" style={{ gridTemplateColumns: `repeat(${fl.doors.length},1fr)` }}>
                  {fl.doors.map(door => {
                    const u = unitBy.get(unitLabel(fl.label, door))
                    const r = u && d.results[u.id]
                    return <button key={door} className={'unit ' + (r ? cellClass(undefined, { ...r, id: '', visit_id: '', unit_id: u!.id, note: r.note }) : '')} onClick={() => u && setEditing(u.id)}>
                      <b>{door || fl.label}</b><span>{r ? (r.person?.name || r.outcomes.map(outcomeLabel).join(' + ') || 'nota') : '—'}</span></button>
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Nota geral</h2>
          <textarea className="t" placeholder="ex.: não entrámos; cartas no correio interior" value={d.generalNote} onChange={e => setD({ ...d, generalNote: e.target.value })} />
        </div>
        {err && <div className="err">{err}</div>}
      </main>
      <div className="fab"><button className="btn" disabled={busy || (!count && !d.generalNote)} onClick={save}>{busy ? 'A gravar…' : `Gravar visita${count ? ` (${count})` : ''}`}</button></div>
      {editing && <ResultSheet f={f} unitId={editing} value={d.results[editing]} onClose={() => setEditing(null)}
        onSave={r => { setD(x => ({ ...x, results: { ...x.results, [editing]: r } })); setEditing(null) }} />}
    </>
  )
}

function ResultSheet({ f, unitId, value, onClose, onSave }: { f: BuildingFull; unitId: string; value?: ResultInput; onClose: () => void; onSave: (r: ResultInput) => void }) {
  const unit = f.units.find(u => u.id === unitId)!
  const [outcomes, setOutcomes] = useState<Outcome[]>(value?.outcomes ?? [])
  const [note, setNote] = useState(value?.note ?? '')
  const known: (Person & { role: Role })[] = f.personUnits.filter(pu => pu.unit_id === unitId)
    .map(pu => ({ ...f.people.find(p => p.id === pu.person_id)!, role: pu.role })).filter(p => p.id)
  const [p, setP] = useState(value?.person ?? { name: '', role: 'proprietario' as Role, phone: '', email: '', traits: '', conversation: '' })
  const [otherUnit, setOtherUnit] = useState(value?.otherUnitNote?.unitId ?? '')
  const [otherText, setOtherText] = useState(value?.otherUnitNote?.text ?? '')
  const talked = outcomes.includes('falei')
  const toggle = (o: Outcome) => setOutcomes(x => (x.includes(o) ? x.filter(y => y !== o) : [...x, o]))

  return (
    <div className="sheet" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="panel">
        <b>{f.building.street}, {f.building.number} · {unit.label}</b>
        <div className="sub">Podes escolher vários</div>
        <div className="opts">{OUTCOMES.map(([o, l]) => <button key={o} className={'opt' + (outcomes.includes(o) ? ' on' : '')} onClick={() => toggle(o)}>{l}</button>)}</div>
        {talked && <>
          {!!known.length && <><label className="f">Já conheço</label><div className="seg">
            {known.map(k => <button key={k.id} className={'chip' + (p.existingId === k.id ? ' on' : '')}
              onClick={() => setP(p.existingId === k.id ? { ...p, existingId: undefined, name: '' } : { ...p, existingId: k.id, name: k.name, role: k.role })}>{k.name}</button>)}
          </div></>}
          <label className="f">Nome</label><input className="t" value={p.name} onChange={e => setP({ ...p, name: e.target.value, existingId: undefined })} placeholder="Nome (ou descrição, se não disse)" />
          <label className="f">Papel</label>
          <select className="t" value={p.role} onChange={e => setP({ ...p, role: e.target.value as Role })}>{ROLES.map(([r, l]) => <option key={r} value={r}>{l}</option>)}</select>
          <div className="two">
            <div><label className="f">Telefone</label><input className="t" type="tel" value={p.phone} onChange={e => setP({ ...p, phone: e.target.value })} /></div>
            <div><label className="f">Email</label><input className="t" type="email" value={p.email} onChange={e => setP({ ...p, email: e.target.value })} /></div>
          </div>
          <label className="f">Traços para reconhecer</label><input className="t" value={p.traits} onChange={e => setP({ ...p, traits: e.target.value })} placeholder="ex.: tem dois cães; carro no parque em frente" />
          <label className="f">Conversa</label><textarea className="t" value={p.conversation} onChange={e => setP({ ...p, conversation: e.target.value })} placeholder="O que disse sobre esta casa" />
          <label className="f">Disse algo sobre outra fração?</label>
          <select className="t" value={otherUnit} onChange={e => setOtherUnit(e.target.value)}>
            <option value="">—</option>{f.units.filter(u => u.id !== unitId).map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
          {otherUnit && <textarea className="t" style={{ marginTop: 6 }} value={otherText} onChange={e => setOtherText(e.target.value)} placeholder="ex.: era de uns suecos que venderam no mês passado" />}
        </>}
        <label className="f">Nota da porta</label><input className="t" value={note} onChange={e => setNote(e.target.value)} placeholder="ex.: em obras; nome na caixa: …" />
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="btn sec" onClick={() => onSave({ unitId, outcomes: [], note: '' })}>Limpar</button>
          <button className="btn" onClick={() => onSave({
            unitId, outcomes, note,
            person: talked && p.name.trim() ? p : undefined,
            otherUnitNote: talked && otherUnit && otherText.trim() ? { unitId: otherUnit, text: otherText } : undefined,
          })}>OK</button>
        </div>
      </div>
    </div>
  )
}
