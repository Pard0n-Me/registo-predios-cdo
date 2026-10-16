import { useEffect, useState } from 'react'
import { getPerson, updatePerson } from '../data/store'
import type { Person } from '../types'
import { fmtDateTime, go, roleLabel } from '../ui'

type Data = Awaited<ReturnType<typeof getPerson>>

export default function PersonPage({ id }: { id: string }) {
  const [d, setD] = useState<Data | null>(null)
  const [p, setP] = useState<Person | null>(null)
  const [dirty, setDirty] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { getPerson(id).then(x => { setD(x); setP(x.person) }).catch(e => setErr(e.message)) }, [id])
  if (!d || !p) return <main>{err ? <div className="err">{err}</div> : <div className="sub" style={{ padding: 20 }}>A carregar…</div>}</main>

  const set = <K extends keyof Person>(k: K, v: Person[K]) => { setP({ ...p, [k]: v }); setDirty(true) }
  const save = async () => {
    try { await updatePerson(p.id, { name: p.name, phone: p.phone, email: p.email, traits: p.traits, notes: p.notes, pipedrive_person_id: p.pipedrive_person_id }); setDirty(false) }
    catch (e) { setErr((e as Error).message) }
  }
  const where = (unitId: string | null) => {
    const u = d.units.find(x => x.id === unitId), b = u && d.buildings.find(x => x.id === u.building_id)
    return u && b ? { text: `${b.street}, ${b.number} · ${u.label}`, href: `#/p/${b.id}/f/${u.id}` } : null
  }

  return (
    <>
      <header className="top"><button className="linkbtn" onClick={() => history.back()}>‹ Voltar</button><h1>{p.name}</h1></header>
      <main>
        <div className="card">
          <label className="f">Nome</label><input className="t" value={p.name} onChange={e => set('name', e.target.value)} />
          <div className="two">
            <div><label className="f">Telefone</label><input className="t" type="tel" value={p.phone ?? ''} onChange={e => set('phone', e.target.value || null)} /></div>
            <div><label className="f">Email</label><input className="t" type="email" value={p.email ?? ''} onChange={e => set('email', e.target.value || null)} /></div>
          </div>
          {(p.phone || p.email) && <div className="seg" style={{ marginTop: 8 }}>
            {p.phone && <a className="chip acc" href={`tel:${p.phone}`}>📞 Ligar</a>}
            {p.phone && <a className="chip acc" href={`sms:${p.phone}`}>💬 SMS</a>}
            {p.email && <a className="chip acc" href={`mailto:${p.email}`}>✉️ Email</a>}
          </div>}
          <label className="f">Traços para reconhecer</label><input className="t" value={p.traits ?? ''} onChange={e => set('traits', e.target.value || null)} />
          <label className="f">Notas</label><textarea className="t" value={p.notes ?? ''} onChange={e => set('notes', e.target.value || null)} />
          <label className="f">Pessoa no Pipedrive (ID)</label>
          <input className="t" inputMode="numeric" value={p.pipedrive_person_id ?? ''} placeholder="Preencher quando houver possibilidade de negócio" onChange={e => set('pipedrive_person_id', e.target.value ? +e.target.value : null)} />
          {p.pipedrive_person_id && <div className="sub" style={{ marginTop: 6 }}><a href={`https://app.pipedrive.com/person/${p.pipedrive_person_id}`} target="_blank" rel="noreferrer">Abrir no Pipedrive ↗</a></div>}
          {dirty && <button className="btn" style={{ width: '100%', marginTop: 10 }} onClick={save}>Gravar</button>}
          {err && <div className="err">{err}</div>}
        </div>
        <div className="card">
          <h2>Frações</h2>
          {d.personUnits.map(pu => { const w = where(pu.unit_id); return w && <div key={pu.unit_id} className="row click" onClick={() => go(w.href.slice(1))}><div>{w.text}<div className="sub">{roleLabel(pu.role)}</div></div>›</div> })}
        </div>
        <div className="card">
          <h2>Conversas</h2>
          {!d.interactions.length && <div className="sub">Nenhuma.</div>}
          {d.interactions.map(i => { const w = where(i.unit_id); return <div key={i.id} className="row" style={{ display: 'block' }}>
            <span className="sub">{fmtDateTime(i.at)}{w ? <> · <a href={w.href}>{w.text}</a></> : ''}</span><div>{i.notes ?? '—'}</div></div> })}
        </div>
      </main>
    </>
  )
}
