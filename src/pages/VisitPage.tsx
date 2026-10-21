import { flash } from '../components/Toast'
import { useEffect, useMemo, useState } from 'react'
import { getBuildingFull, saveVisit, unitLabel, type ResultInput } from '../data/store'
import type { BuildingFull, Channel, Delivery, Outcome, Person, Piece, Role } from '../types'
import { CHANNELS, COMPANIONS, RESULTS, ROLES, cellClass, deliveryLabel, fmtDateTime, resultText, toLocalInput } from '../ui'
import { usePieces } from '../data/pieces'

interface Draft { visitedAt: string; companion: string | null; generalNote: string; results: Record<string, ResultInput> }
const draftKey = (id: string, visitId?: string) => `visita-rascunho-${id}${visitId ? '-' + visitId : ''}`
const loadDraft = (key: string): Draft | null => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null } catch { return null } }
const sameDay = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()

/** Visita nova, ou uma já gravada reaberta para editar (visitId). */
export default function VisitPage({ id, visitId }: { id: string; visitId?: string }) {
  const key = draftKey(id, visitId)
  const [f, setF] = useState<BuildingFull | null>(null)
  const [restored] = useState(() => !!loadDraft(key))
  // ao editar sem rascunho, os dados vêm da base quando a ficha carregar
  const [d, setD] = useState<Draft | null>(() => loadDraft(key) ?? (visitId ? null : { visitedAt: toLocalInput(), companion: null, generalNote: '', results: {} }))
  const [dirty, setDirty] = useState(restored)
  const [skipToday, setSkipToday] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [other, setOther] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const change = (x: Draft) => { setD(x); setDirty(true) }

  useEffect(() => {
    getBuildingFull(id).then(x => {
      setF(x)
      const v = visitId && x.visits.find(y => y.id === visitId)
      if (visitId && !v) { setErr('Visita não encontrada (foi apagada?).'); return }
      if (v) setD(cur => cur ?? {
        visitedAt: toLocalInput(new Date(v.visited_at)), companion: v.companion, generalNote: v.general_note ?? '',
        results: Object.fromEntries(x.results.filter(r => r.visit_id === v.id).map(r => [r.unit_id, { unitId: r.unit_id, outcomes: r.outcomes, deliveries: r.deliveries ?? [], note: r.note ?? '' }])),
      })
    }).catch(e => setErr(e.message))
  }, [id, visitId])
  useEffect(() => { if (d && dirty) try { localStorage.setItem(key, JSON.stringify(d)) } catch { /* sem armazenamento */ } }, [d, dirty, key])

  const pieces = usePieces()
  const unitBy = useMemo(() => new Map((f?.units ?? []).map(u => [u.label, u])), [f])
  if (!f || !d) return <main>{err ? <div className="err">{err}</div> : <div className="sub" style={{ padding: 20 }}>A carregar…</div>}</main>
  const b = f.building
  const count = Object.values(d.results).filter(r => r.outcomes.length || r.note || r.deliveries?.length).length
  // quem já ficou registado nesta visita (ao editar), para mostrar na grelha
  const savedPerson = (unitId: string) => {
    const i = visitId && f.interactions.find(x => x.visit_id === visitId && x.unit_id === unitId)
    return i ? f.people.find(p => p.id === i.person_id)?.name : undefined
  }
  const today = !visitId && !restored && !skipToday ? f.visits.find(v => v.origin === 'novo' && sameDay(v.visited_at)) : undefined

  const save = async () => {
    setBusy(true); setErr('')
    try {
      await saveVisit({ visitId, buildingId: id, visitedAt: new Date(d.visitedAt).toISOString(), companion: d.companion, generalNote: d.generalNote, results: Object.values(d.results) })
      try { localStorage.removeItem(key) } catch { /* ignora */ }
      flash(`${visitId ? 'Visita atualizada' : 'Visita gravada'}${count ? ` · ${count} ${count === 1 ? 'porta' : 'portas'}` : ''}`)
      location.replace(`#/p/${id}`)
    } catch (e) { setErr((e as Error).message + ' · O rascunho continua guardado no telefone.') } finally { setBusy(false) }
  }
  const discard = () => {
    if (!confirm(visitId ? 'Descartar as alterações a esta visita?' : 'Apagar este rascunho de visita?')) return
    try { localStorage.removeItem(key) } catch { /* ignora */ }
    location.replace(`#/p/${id}`)
  }
  const back = () => {
    if (dirty && !confirm('Sair sem gravar? O que marcaste fica como rascunho neste telefone e volta quando abrires esta visita.')) return
    history.back()
  }

  return (
    <>
      <header className="top"><button className="linkbtn" onClick={back}>‹ Prédio</button><h1>{visitId ? 'Editar visita' : 'Visita'} · {b.street.replace(/^Rua /, 'R. ')}, {b.number}</h1></header>
      <main>
        {restored && <div className="note">{visitId ? 'Alterações por gravar recuperadas deste telefone.' : 'Rascunho recuperado deste telefone.'} <button className="linkbtn" onClick={discard}>{visitId ? 'Descartar' : 'Apagar'}</button></div>}
        {today && <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <b>Já há uma visita de hoje a este prédio</b>
          <div className="sub">{(() => { const n = f.results.filter(r => r.visit_id === today.id).length; return `${fmtDateTime(today.visited_at)} · ${n} ${n === 1 ? 'porta' : 'portas'}` })()}{today.companion ? ` · com ${today.companion}` : ''}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn" onClick={() => location.replace(`#/p/${id}/visita/${today.id}`)}>Continuar essa visita</button>
            <button className="btn sec" onClick={() => setSkipToday(true)}>É outra visita</button>
          </div>
        </div>}
        <div className="card">
          <h2>Acompanhante</h2>
          <div className="seg">
            <button className={'chip' + (d.companion === null ? ' on' : '')} onClick={() => change({ ...d, companion: null })}>Sozinho</button>
            {COMPANIONS.map(c => <button key={c} className={'chip' + (d.companion === c ? ' on' : '')} onClick={() => change({ ...d, companion: c })}>{c}</button>)}
            {other || (d.companion && !COMPANIONS.includes(d.companion))
              ? <input className="t" style={{ width: 140 }} placeholder="Nome" value={d.companion && !COMPANIONS.includes(d.companion) ? d.companion : other} onChange={e => { setOther(e.target.value); change({ ...d, companion: e.target.value || null }) }} />
              : <button className="chip" onClick={() => setOther(' ')}>+ outro</button>}
          </div>
          <label className="f">Data e hora</label>
          <input className="t" type="datetime-local" value={d.visitedAt} onChange={e => change({ ...d, visitedAt: e.target.value })} />
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
                      <b>{door || fl.label}</b><span>{r ? (r.person?.name || (r.outcomes.includes('falei') && savedPerson(u!.id)) || resultText(r, pieces) || 'nota') : '—'}</span></button>
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Nota geral</h2>
          <textarea className="t" placeholder="ex.: não entrámos; cartas no correio interior" value={d.generalNote} onChange={e => change({ ...d, generalNote: e.target.value })} />
        </div>
        {err && <div className="err">{err}</div>}
      </main>
      <div className="fab"><button className="btn" disabled={busy || (!count && !d.generalNote)} onClick={save}>{busy ? 'A gravar…' : `${visitId ? 'Gravar alterações' : 'Gravar visita'}${count ? ` (${count})` : ''}`}</button></div>
      {editing && <ResultSheet f={f} pieces={pieces} unitId={editing} value={d.results[editing]} onClose={() => setEditing(null)}
        onSave={r => { change({ ...d, results: { ...d.results, [editing]: r } }); setEditing(null) }} />}
    </>
  )
}

function ResultSheet({ f, pieces, unitId, value, onClose, onSave }: { f: BuildingFull; pieces: Piece[]; unitId: string; value?: ResultInput; onClose: () => void; onSave: (r: ResultInput) => void }) {
  const unit = f.units.find(u => u.id === unitId)!
  const [outcomes, setOutcomes] = useState<Outcome[]>(value?.outcomes ?? [])
  const [deliveries, setDeliveries] = useState<Delivery[]>(value?.deliveries ?? [])
  const [piece, setPiece] = useState<string | null>(null)
  const [warn, setWarn] = useState('')
  const [note, setNote] = useState(value?.note ?? '')
  const known: (Person & { role: Role })[] = f.personUnits.filter(pu => pu.unit_id === unitId)
    .map(pu => ({ ...f.people.find(p => p.id === pu.person_id)!, role: pu.role })).filter(p => p.id)
  const [p, setP] = useState(value?.person ?? { name: '', role: 'proprietario' as Role, phone: '', email: '', traits: '', conversation: '' })
  const [otherUnit, setOtherUnit] = useState(value?.otherUnitNote?.unitId ?? '')
  const [otherText, setOtherText] = useState(value?.otherUnitNote?.text ?? '')
  const talked = outcomes.includes('falei')
  const toggle = (o: Outcome) => { setWarn(''); setOutcomes(x => (x.includes(o) ? x.filter(y => y !== o) : [...x, o])) }
  const noAds = f.building.no_ads === 'sim'
  const active = pieces.filter(x => x.active)
  const deliver = (c: Channel) => {
    if (!piece) { setWarn('Escolhe primeiro a peça.'); return }
    setDeliveries(x => [...x, { piece, channel: c }]); setPiece(null); setWarn('')
  }
  const hasResult = outcomes.some(o => RESULTS.some(([r]) => r === o))
  const ok = () => {
    if (deliveries.length && !hasResult) { setWarn('Falta o resultado (ex.: Não abriu) antes de registar a entrega.'); return }
    onSave({
      unitId, outcomes, deliveries, note,
      person: talked && p.name.trim() ? p : undefined,
      otherUnitNote: talked && otherUnit && otherText.trim() ? { unitId: otherUnit, text: otherText } : undefined,
    })
  }

  return (
    <div className="sheet" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="panel">
        <b>{f.building.street}, {f.building.number} · {unit.label}</b>
        <label className="f">Resultado</label>
        <div className="opts" style={{ marginTop: 4 }}>{RESULTS.map(([o, l]) => <button key={o} className={'opt' + (outcomes.includes(o) ? ' on' : '')} onClick={() => toggle(o)}>{l}</button>)}</div>
        <label className="f">Deixei <span className="sub">· toca na peça e depois no canal</span></label>
        <div className="deliver">
          <div className="pieces">
            {active.map(x => <button key={x.id} className={'piece' + (piece === x.id ? ' on' : '')} aria-pressed={piece === x.id} onClick={() => { setPiece(piece === x.id ? null : x.id); setWarn('') }}>
              {x.thumb ? <img src={x.thumb} alt="" /> : <span className="nothumb" />}<span>{x.short_name}</span></button>)}
            {!active.length && <div className="sub">Sem peças. Acrescenta-as em Início › Peças de marketing.</div>}
          </div>
          <div className="channels">
            {CHANNELS.map(([c, l]) => <button key={c} className="opt" disabled={c === 'caixa' && noAds} onClick={() => deliver(c)}>{l}</button>)}
            {noAds && <div className="sub">Prédio com "publicidade não": caixa do correio bloqueada.</div>}
          </div>
        </div>
        {!!deliveries.length && <div className="chips" style={{ marginTop: 8 }}>
          {deliveries.map((d, i) => <button key={i} className="chip acc" aria-label={`Tirar ${deliveryLabel(d, pieces)}`} onClick={() => setDeliveries(x => x.filter((_, j) => j !== i))}>{deliveryLabel(d, pieces)} ✕</button>)}
        </div>}
        {warn && <div className="err" style={{ marginTop: 8 }}>{warn}</div>}
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
          <button className="btn sec" onClick={() => onSave({ unitId, outcomes: [], deliveries: [], note: '' })}>Limpar</button>
          <button className="btn" onClick={ok}>OK</button>
        </div>
      </div>
    </div>
  )
}
