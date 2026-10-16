import { useEffect, useState } from 'react'
import MapView from '../components/MapView'
import { geocode, getBuildingFull, saveBuilding } from '../data/store'
import type { Building, Cond, Floor, Tri } from '../types'
import { COND, TRI } from '../ui'

const EMPTY: Omit<Building, 'id'> = {
  street: '', number: '', corner_note: null, lat: null, lng: null, floors: [],
  construction: '?', elevator: '?', garage: '?', storage: '?', storage_note: null, ground_commerce: '?', commerce_desc: null,
  porter: '?', mailbox: '?', horizontal_property: '?', orientation: '?', cond_ext: '?', cond_int: '?', condo_admin: null, notes: null, origin: 'novo',
}

const PATTERNS: [string, string[]][] = [
  ['1 por piso', ['']], ['Esq · Dto', ['Esq', 'Dto']], ['Esq · Fte · Dto', ['Esq', 'Fte', 'Dto']], ['A · B', ['A', 'B']], ['A · B · C · D', ['A', 'B', 'C', 'D']],
]

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return <div className="seg">{options.map(([v, l]) => <button type="button" key={v} className={'chip' + (v === value ? ' on' : '')} onClick={() => onChange(v)}>{l}</button>)}</div>
}

export default function BuildingForm({ id, initial }: { id?: string; initial?: { street?: string; number?: string } }) {
  const [b, setB] = useState<Partial<Building>>({ ...EMPTY, street: initial?.street ?? '', number: initial?.number ?? '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [gen, setGen] = useState({ floors: 4, rc: true, cave: false, pattern: 1 })

  useEffect(() => { if (id) getBuildingFull(id).then(f => setB(f.building)).catch(e => setErr(e.message)) }, [id])
  const set = <K extends keyof Building>(k: K, v: Building[K]) => setB(x => ({ ...x, [k]: v }))
  const floors = b.floors ?? []

  const generate = () => {
    const doors = PATTERNS[gen.pattern][1]
    const fl: Floor[] = []
    for (let i = gen.floors; i >= 1; i--) fl.push({ label: `${i}.º`, doors: [...doors] })
    if (gen.rc) fl.push({ label: 'RC', doors: [...doors] })
    if (gen.cave) fl.push({ label: 'Cave', doors: [...doors] })
    set('floors', fl)
  }
  const setFloor = (i: number, f: Floor) => set('floors', floors.map((x, j) => (j === i ? f : x)))

  const locate = async () => {
    setErr('')
    if (!b.street || !b.number) { setErr('Falta a rua e o número.'); return }
    const g = await geocode(b.street, b.number).catch(() => null)
    if (g) setB(x => ({ ...x, lat: g.lat, lng: g.lng }))
    else setErr('Não encontrei a morada no mapa. Toca no mapa para marcar o prédio.')
  }

  const submit = async () => {
    setErr('')
    if (!b.street?.trim() || !b.number?.trim()) { setErr('Rua e número são obrigatórios.'); return }
    setBusy(true)
    try {
      const saved = await saveBuilding({ ...b, street: b.street.trim(), number: b.number.trim() } as Building)
      location.replace(`#/p/${saved.id}`)
    } catch (e) {
      const m = (e as Error).message
      setErr(/duplicate|unique/i.test(m) ? 'Já existe um prédio com esta morada.' : m)
    } finally { setBusy(false) }
  }

  const tri = (k: keyof Building, label: string) => (
    <><label className="f">{label}</label><Seg<Tri> value={(b[k] as Tri) ?? '?'} options={TRI} onChange={v => set(k, v as never)} /></>
  )

  return (
    <>
      <header className="top"><button className="linkbtn" onClick={() => history.back()}>‹ Voltar</button><h1>{id ? 'Editar prédio' : 'Novo prédio'}</h1></header>
      <main>
        <div className="card">
          <label className="f">Rua</label><input className="t" value={b.street ?? ''} onChange={e => set('street', e.target.value)} placeholder="Rua Correia Teles" />
          <div className="two">
            <div><label className="f">Número</label><input className="t" value={b.number ?? ''} onChange={e => set('number', e.target.value)} inputMode="text" /></div>
            <div><label className="f">Gaveto / esquina</label><input className="t" value={b.corner_note ?? ''} onChange={e => set('corner_note', e.target.value || null)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
            <button className="btn sec small" onClick={locate}>📍 Localizar no mapa</button>
            <span className="sub">{b.lat != null ? 'Posição marcada. Toca no mapa para corrigir.' : 'Sem posição'}</span>
          </div>
          <MapView small pins={b.lat != null ? [{ id: 'x', lat: b.lat!, lng: b.lng!, color: '#0f5c8c', label: b.number || '•', title: '' }] : []}
            center={b.lat != null ? [b.lat!, b.lng!] : null} onMapTap={(lat, lng) => setB(x => ({ ...x, lat, lng }))} />
        </div>

        <div className="card">
          <h2>Pisos e frações</h2>
          <div className="two">
            <div><label className="f">Pisos acima do RC</label><input className="t" type="number" min={0} max={15} value={gen.floors} onChange={e => setGen({ ...gen, floors: +e.target.value })} /></div>
            <div><label className="f">Portas por piso</label>
              <select className="t" value={gen.pattern} onChange={e => setGen({ ...gen, pattern: +e.target.value })}>{PATTERNS.map(([l], i) => <option key={l} value={i}>{l}</option>)}</select></div>
          </div>
          <div className="seg" style={{ marginTop: 10 }}>
            <button className={'chip' + (gen.rc ? ' on' : '')} onClick={() => setGen({ ...gen, rc: !gen.rc })}>RC</button>
            <button className={'chip' + (gen.cave ? ' on' : '')} onClick={() => setGen({ ...gen, cave: !gen.cave })}>Cave</button>
            <button className="btn sec small" style={{ marginLeft: 'auto' }} onClick={generate}>Gerar grelha</button>
          </div>
          {!!floors.length && <div className="sub" style={{ margin: '12px 0 6px' }}>Ajusta piso a piso (portas separadas por vírgula; vazio = 1 por piso):</div>}
          {floors.map((f, i) => (
            <div className="floor-edit" key={i}>
              <input className="t" value={f.label} onChange={e => setFloor(i, { ...f, label: e.target.value })} />
              <input className="t" value={f.doors.join(', ')} onChange={e => setFloor(i, { ...f, doors: e.target.value.split(',').map(s => s.trim()).filter((s, _k, a) => s || a.length === 1) })} />
              <button className="x" onClick={() => set('floors', floors.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          {!!floors.length && <button className="linkbtn" onClick={() => set('floors', [{ label: '', doors: [''] }, ...floors])}>+ piso no topo</button>}
          {id && <div className="note">Retirar portas da grelha não apaga as frações já registadas.</div>}
        </div>

        <div className="card">
          <h2>Características</h2>
          <label className="f">Construção</label>
          <Seg value={b.construction ?? '?'} options={[['betao', 'Betão / placa'], ['tabique', 'Tabique'], ['misto', 'Misto'], ['?', '?']]} onChange={v => set('construction', v)} />
          {tri('elevator', 'Elevador')}
          {tri('garage', 'Garagens')}
          {tri('storage', 'Arrecadações')}
          {b.storage === 'sim' && <input className="t" style={{ marginTop: 6 }} placeholder="ex.: no sótão" value={b.storage_note ?? ''} onChange={e => set('storage_note', e.target.value || null)} />}
          {tri('ground_commerce', 'Comércio no RC')}
          {b.ground_commerce === 'sim' && <input className="t" style={{ marginTop: 6 }} placeholder="Qual? ex.: pastelaria" value={b.commerce_desc ?? ''} onChange={e => set('commerce_desc', e.target.value || null)} />}
          {tri('porter', 'Porteira residente')}
          <label className="f">Caixas de correio</label>
          <Seg value={b.mailbox ?? '?'} options={[['exterior', 'Exterior'], ['interior', 'Interior'], ['?', '?']]} onChange={v => set('mailbox', v)} />
          {tri('horizontal_property', 'Propriedade horizontal')}
          <label className="f">Conservação exterior</label><Seg<Cond> value={b.cond_ext ?? '?'} options={COND} onChange={v => set('cond_ext', v)} />
          <label className="f">Conservação interior (zonas comuns)</label><Seg<Cond> value={b.cond_int ?? '?'} options={COND} onChange={v => set('cond_int', v)} />
          <label className="f">Orientação solar</label>
          <input className="t" list="orient" value={b.orientation === '?' ? '' : b.orientation ?? ''} placeholder="?" onChange={e => set('orientation', e.target.value || '?')} />
          <datalist id="orient">{['Nascente/Poente', 'Norte/Sul', 'Nascente', 'Poente', 'Norte', 'Sul', 'Sul/Poente', 'Norte/Nascente'].map(o => <option key={o} value={o} />)}</datalist>
          <label className="f">Administração do condomínio</label>
          <input className="t" value={b.condo_admin ?? ''} placeholder="empresa ou condómino (fração)" onChange={e => set('condo_admin', e.target.value || null)} />
          <label className="f">Notas do prédio</label>
          <textarea className="t" value={b.notes ?? ''} onChange={e => set('notes', e.target.value || null)} />
        </div>
        {err && <div className="err">{err}</div>}
      </main>
      <div className="fab"><button className="btn" disabled={busy} onClick={submit}>{busy ? 'A gravar…' : 'Gravar prédio'}</button></div>
    </>
  )
}
