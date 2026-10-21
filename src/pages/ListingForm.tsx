import { flash } from '../components/Toast'
import { useEffect, useState } from 'react'
import { addPersonToUnit, createPerson, getBuildingFull, saveListing } from '../data/store'
import type { BuildingFull, Cond, Listing, Role } from '../types'
import { COND, ROLES, fmtDate, fmtPrice } from '../ui'

const today = () => new Date().toISOString().slice(0, 10)

export default function ListingForm({ buildingId, listingId, unitId }: { buildingId: string; listingId?: string; unitId?: string }) {
  const [f, setF] = useState<BuildingFull | null>(null)
  const [l, setL] = useState<Partial<Listing>>({
    building_id: buildingId, unit_id: unitId ?? null, operation: 'venda', first_seen: today(), first_seen_uncertain: false,
    advertiser_type: '?', active: true, source: null,
  })
  const [price, setPrice] = useState('')
  const [priceAt, setPriceAt] = useState(today())
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [contact, setContact] = useState('')          // '' = nenhum, 'novo' = pessoa nova, senão id
  const [nc, setNc] = useState({ name: '', phone: '', role: '' as Role | '', notes: '' })

  useEffect(() => {
    getBuildingFull(buildingId).then(x => {
      setF(x)
      if (listingId) { const found = x.listings.find(y => y.id === listingId); if (found) { setL(found); setContact(found.contact_person_id ?? '') } }
    }).catch(e => setErr(e.message))
  }, [buildingId, listingId])
  if (!f) return <main>{err ? <div className="err">{err}</div> : <div className="sub" style={{ padding: 20 }}>A carregar…</div>}</main>
  const set = <K extends keyof Listing>(k: K, v: Listing[K]) => setL(x => ({ ...x, [k]: v }))
  const prices = listingId ? f.prices.filter(p => p.listing_id === listingId).sort((a, b) => b.at.localeCompare(a.at)) : []

  const submit = async () => {
    setBusy(true); setErr('')
    try {
      const p = price ? +price.replace(/[^\d]/g, '') : null
      let contactId: string | null | undefined = contact === 'novo' ? undefined : contact || null
      if (contact === 'novo') {
        if (!nc.name.trim()) { setErr('Falta o nome do contacto (pode ser uma descrição, ex.: dono da loja).'); setBusy(false); return }
        const role: Role = nc.role || (l.advertiser_type === 'particular' ? 'proprietario' : 'outro')
        const extra = { name: nc.name, phone: nc.phone, notes: nc.notes, traits: l.advertiser_type === 'agencia' && l.advertiser ? `Agente (${l.advertiser})` : undefined }
        contactId = l.unit_id ? await addPersonToUnit(l.unit_id, { ...extra, role }) : await createPerson(extra)
      }
      // só manda o campo quando há contacto ou quando se tira um que existia (a coluna é de 20/10)
      const withContact = contactId || l.contact_person_id ? { contact_person_id: contactId ?? null } : {}
      // o estado também só vai quando há valor (a coluna é de 21/10)
      const { condition, ...rest } = l
      const had = listingId ? f.listings.find(x => x.id === listingId)?.condition : null
      const withCond = (condition && condition !== '?') || had ? { condition: condition ?? null } : {}
      const { kept } = await saveListing({ ...rest, ...withContact, ...withCond, building_id: buildingId, price: p, price_at: listingId ? priceAt : l.first_seen })
      flash((listingId ? 'Anúncio atualizado' : 'Anúncio gravado') + (kept.length ? ` · a fração mantém ${kept.join(', ')}` : ''))
      location.replace(`#/p/${buildingId}`)
    } catch (e) {
      const m = (e as Error).message
      setErr(/contact_person_id/.test(m) ? 'Falta acrescentar a coluna do contacto na Supabase: corre o ficheiro supabase/migracoes/2026-10-20-contacto-anuncio.sql no SQL Editor.'
        : /condition/.test(m) ? 'Falta acrescentar a coluna do estado na Supabase: corre o ficheiro supabase/migracoes/2026-10-21-estado-anuncio.sql no SQL Editor. (Sem estado escolhido, grava na mesma.)' : m)
    } finally { setBusy(false) }
  }
  const candidates = [...f.people].sort((a, b) => {
    const onUnit = (id: string) => f.personUnits.some(pu => pu.person_id === id && pu.unit_id === l.unit_id) ? 0 : 1
    return onUnit(a.id) - onUnit(b.id) || a.name.localeCompare(b.name, 'pt')
  })
  if (l.contact_person_id && !candidates.some(p => p.id === l.contact_person_id)) candidates.unshift({ id: l.contact_person_id, name: 'Contacto atual', phone: null, email: null, traits: null, notes: null, pipedrive_person_id: null })

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
          <label className="f" htmlFor="estado">Estado de conservação</label>
          <select id="estado" className="t" value={l.condition ?? '?'} onChange={e => set('condition', e.target.value as Cond)}>
            {COND.map(([c, t]) => <option key={c} value={c}>{c === '?' ? '? (o anúncio não diz)' : t}</option>)}
          </select>
          {l.unit_id && <div className="sub" style={{ marginTop: 4 }}>Tipologia, área e estado passam para a fração só se lá estiverem vazios.</div>}
          <label className="f">Anunciante</label>
          <div className="seg">{([['particular', 'Particular (FSBO)'], ['agencia', 'Agência'], ['promotor', 'Promotor'], ['?', '?']] as const).map(([v, t]) =>
            <button key={v} className={'chip' + (l.advertiser_type === v ? ' on' : '')} onClick={() => set('advertiser_type', v)}>{t}</button>)}</div>
          {l.advertiser_type !== 'particular' && <input className="t" style={{ marginTop: 6 }} value={l.advertiser ?? ''} placeholder="Qual? ex.: KW, C21" onChange={e => set('advertiser', e.target.value || null)} />}
          <label className="f" htmlFor="contacto">Contacto do anúncio</label>
          <select id="contacto" className="t" value={contact} onChange={e => setContact(e.target.value)}>
            <option value="">— sem contacto</option>
            {candidates.map(p => <option key={p.id} value={p.id}>{p.name}{p.phone ? ` · ${p.phone}` : ''}</option>)}
            <option value="novo">+ Nova pessoa…</option>
          </select>
          {contact === 'novo' && <div className="note" style={{ marginTop: 6 }}>
            <div className="two">
              <div><label className="f" htmlFor="nc-name">Nome</label><input id="nc-name" className="t" value={nc.name} placeholder="ou descrição: dono da loja" onChange={e => setNc({ ...nc, name: e.target.value })} /></div>
              <div><label className="f" htmlFor="nc-phone">Telefone</label><input id="nc-phone" className="t" type="tel" value={nc.phone} onChange={e => setNc({ ...nc, phone: e.target.value })} /></div>
            </div>
            <label className="f" htmlFor="nc-role">Papel</label>
            <select id="nc-role" className="t" value={nc.role} onChange={e => setNc({ ...nc, role: e.target.value as Role })}>
              <option value="">{l.advertiser_type === 'particular' ? 'Proprietário (FSBO)' : 'Outro (ex.: agente)'}</option>
              {ROLES.map(([r, t]) => <option key={r} value={r}>{t}</option>)}
            </select>
            <label className="f" htmlFor="nc-notes">Notas</label><input id="nc-notes" className="t" value={nc.notes} placeholder="ex.: 2.º número; atende de manhã" onChange={e => setNc({ ...nc, notes: e.target.value })} />
            <div className="sub" style={{ marginTop: 6 }}>{l.unit_id ? 'Fica também ligada à fração.' : 'Sem fração escolhida: fica só como contacto do anúncio.'}</div>
          </div>}
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
