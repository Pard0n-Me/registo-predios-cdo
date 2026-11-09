import { deleteWithUndo } from '../components/Toast'
import Icon from '../components/Icon'
import Reload from '../components/Reload'
import { useEffect, useState } from 'react'
import MapView from '../components/MapView'
import { deleteListing, deleteVisit, geocode, getBuildingFull, setBuildingPosition, unitLabel } from '../data/store'
import type { Building, BuildingFull, Listing, Unit, Visit, VisitResult } from '../types'
import { cellClass, condLabel, fmtDate, fmtDateTime, fmtPrice, go, goRoot, listingState, resultText, roleLabel, statusLabel } from '../ui'
import { usePieces } from '../data/pieces'
import { addressText, plural } from '../data/resumo'
import type { Piece } from '../types'

function chips(b: Building): [string, string][] {
  const t = (v: string, yes: string, no: string, q: string): [string, string] =>
    v === 'sim' ? [yes, 'ok'] : v === 'nao' ? [no, ''] : [q, 'q']
  const out: [string, string][] = [
    b.construction === '?' ? ['Construção ?', 'q'] : [{ betao: 'Betão / placa', tabique: 'Tabique', misto: 'Misto' }[b.construction], 'acc'],
    t(b.elevator, 'Elevador', 'Sem elevador', 'Elevador ?'),
    t(b.garage, 'Garagens', 'Sem garagens', 'Garagens ?'),
    t(b.storage, 'Arrecadações' + (b.storage_note ? ` (${b.storage_note})` : ''), 'Sem arrecadações', 'Arrecadações ?'),
    b.ground_commerce === 'sim' ? [`RC: ${b.commerce_desc || 'comércio'}`, 'acc'] : b.ground_commerce === 'nao' ? ['RC: habitação', ''] : ['Comércio RC ?', 'q'],
    t(b.porter, 'Porteira residente', 'Sem porteira', 'Porteira ?'),
    ...(b.no_ads === 'sim' ? [['Publicidade não', 'warn'] as [string, string]] : []),
    b.mailbox === '?' ? ['Caixas ?', 'q'] : [`Caixas no ${b.mailbox}`, ''],
    t(b.horizontal_property, 'PH', 'Sem PH (prédio inteiro)', 'PH ?'),
    b.cond_ext === '?' ? ['Exterior ?', 'q'] : [`Exterior: ${condLabel(b.cond_ext).toLowerCase()}`, b.cond_ext === 'bom' ? 'ok' : b.cond_ext === 'mau' ? 'bad' : 'warn'],
    b.cond_int === '?' ? ['Interior ?', 'q'] : [`Interior: ${condLabel(b.cond_int).toLowerCase()}`, b.cond_int === 'bom' ? 'ok' : b.cond_int === 'mau' ? 'bad' : 'warn'],
    b.orientation === '?' ? ['Orientação ?', 'q'] : [b.orientation, ''],
  ]
  return out
}

export type Ev = { kind: 'visit'; at: string; v: Visit } | { kind: 'listing'; at: string; l: Listing }

export default function BuildingPage({ id }: { id: string }) {
  const pieces = usePieces()
  const [f, setF] = useState<BuildingFull | null>(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<Ev | null>(null)
  const [moving, setMoving] = useState(false)
  const [posMsg, setPosMsg] = useState('')
  const [showChars, setShowChars] = useState(false)
  useEffect(() => { getBuildingFull(id).then(setF).catch(e => setErr(e.message)) }, [id])
  if (err) return <main><div className="err">{err}</div></main>
  if (!f) return <main><div className="sub" style={{ padding: 20 }}>A carregar…</div></main>
  const b = f.building

  // último resultado por fração (visitas já vêm da mais recente para a mais antiga)
  const last = new Map<string, VisitResult>()
  for (const v of f.visits) for (const r of f.results.filter(r => r.visit_id === v.id)) if (!last.has(r.unit_id)) last.set(r.unit_id, r)
  const unitBy = new Map(f.units.map(u => [u.label, u]))
  const nUnits = b.floors.reduce((a, x) => a + x.doors.length, 0)
  const subtitle = [
    b.floors.length ? `${plural(b.floors.length, 'piso', 'pisos')} · ${plural(nUnits, 'fração', 'frações')}` : '',
    b.corner_note ?? '', b.origin === 'legado' ? 'legado' : '',
  ].filter(Boolean).join(' · ')
  const gridLabels = new Set(b.floors.flatMap(x => x.doors.map(d => unitLabel(x.label, d))))
  const extraUnits = f.units.filter(u => !gridLabels.has(u.label))

  // Um anúncio de venda ativo manda sobre o estado guardado na fração (que pode estar desatualizado),
  // exceto quando o António marcou à mão Vendido, Arrendado ou Em vigilância.
  const effStatus = (u: Unit) => {
    if (u.commercial_status === 'vendido' || u.commercial_status === 'arrendado' || u.commercial_status === 'vigilancia') return u.commercial_status
    const l = f.listings.find(x => x.unit_id === u.id && x.active && x.operation === 'venda')
    return l ? (l.advertiser_type === 'particular' ? 'fsbo' : 'fsba') : u.commercial_status
  }
  const cellText = (u: Unit | undefined) => {
    if (!u) return '—'
    const p = f.personUnits.find(pu => pu.unit_id === u.id)
    const person = p && f.people.find(x => x.id === p.person_id)
    const st = effStatus(u)
    if (st !== 'nada') return statusLabel(st) + (person ? ` · ${person.name}` : '')
    const r = last.get(u.id)
    if (!r) return person ? person.name : u.typology ?? '—'
    return r.outcomes.includes('falei') && person ? person.name : resultText(r, pieces)
  }

  const events: Ev[] = [
    ...f.visits.map(v => ({ kind: 'visit' as const, at: v.visited_at, v })),
    ...f.listings.map(l => ({ kind: 'listing' as const, at: l.first_seen, l })),
  ].sort((a, c) => c.at.localeCompare(a.at))

  return (
    <>
      <header className="top"><button className="linkbtn" onClick={goRoot}>‹ Voltar</button><h1 className="wrap2">{addressText(b)}</h1><button className="linkbtn" onClick={() => go(`/p/${id}/editar`)}>Editar</button><Reload /></header>
      <main>
        <div className="card">
          <h2>Frações · último resultado</h2>
          {subtitle && <div className="sub" style={{ marginTop: -4, marginBottom: 8 }}>{subtitle}</div>}
          {b.no_ads === 'sim' && <div className="chips" style={{ marginBottom: 8 }}><span className="chip warn">Publicidade não</span></div>}
          {!b.floors.length && (
            <div className="emptybox">
              <div>Este prédio ainda não tem pisos e frações.</div>
              <button className="btn tonal" onClick={() => go(`/p/${id}/editar`)}>Definir pisos e frações</button>
            </div>
          )}
          <div className="grid">
            {b.floors.map(fl => (
              <div className="floor" key={fl.label}>
                <div className="floor-label">{fl.label}</div>
                <div className="units" style={{ gridTemplateColumns: `repeat(${fl.doors.length},1fr)` }}>
                  {fl.doors.map(d => {
                    const u = unitBy.get(unitLabel(fl.label, d))
                    return <button key={d} className={'unit ' + cellClass(u && effStatus(u), u && last.get(u.id))} onClick={() => u && go(`/p/${id}/f/${u.id}`)}>
                      <b>{d || fl.label}</b><span>{cellText(u)}</span></button>
                  })}
                </div>
              </div>
            ))}
          </div>
          {!!extraUnits.length && b.floors.length > 0 && <div style={{ marginTop: 12 }}>
            <div className="sub">Fora da grelha (toca para juntar a uma fração ou apagar):</div>
            <div className="chips" style={{ marginTop: 6 }}>{extraUnits.map(u => <button key={u.id} className="chip warn" onClick={() => go(`/p/${id}/f/${u.id}`)}>{u.label}</button>)}</div>
          </div>}
          {!!extraUnits.length && !b.floors.length && <div className="chips" style={{ marginTop: 10 }}>{extraUnits.map(u => <button key={u.id} className="chip" onClick={() => go(`/p/${id}/f/${u.id}`)}>{u.label}</button>)}</div>}
          <div className="legend" style={{ marginTop: 10 }}>
            <span><i className="dot" style={{ background: 'var(--ok)' }} />Falei</span>
            <span><i className="dot" style={{ background: 'var(--accent)' }} />Entrega / outro</span>
            <span><i className="dot" style={{ background: 'var(--warn)' }} />Caixa cheia</span>
            <span><i className="dot" style={{ background: 'var(--bad)' }} />À venda</span>
          </div>
        </div>

        <div className="card">
          <h2>Histórico</h2>
          {!events.length && <div className="sub">Ainda nada.</div>}
          {events.map(e => (
            <div className="ev" key={(e.kind === 'visit' ? e.v.id : e.l.id)} onClick={() => setOpen(e)}>
              <div className="d">{e.kind === 'visit' ? fmtDate(e.v.visited_at, e.v.year_uncertain) : fmtDate(e.l.first_seen, e.l.first_seen_uncertain)}</div>
              <div>{e.kind === 'visit' ? visitLine(e.v, f) : listingLine(e.l, f)}</div>
              <div className="sub">›</div>
            </div>
          ))}
        </div>
        <div className="card">
          {(() => {
            const all = chips(b), known = all.filter(([, c]) => c !== 'q'), unknown = all.length - known.length
            const hasNotes = !!(b.condo_admin || b.notes)
            return <>
              <button className="fold" aria-expanded={showChars} onClick={() => setShowChars(x => !x)}>
                <h2 style={{ margin: 0 }}>Características</h2>
                <span className="sub" style={{ whiteSpace: 'nowrap' }}>{known.length} preenchidas{hasNotes ? ' · notas' : ''} <span aria-hidden="true">{showChars ? '▴' : '▾'}</span></span>
              </button>
              {showChars && <>
                <div className="chips" style={{ marginTop: 10 }}>
                  {known.map(([t, c]) => <span key={t} className={'chip ' + c}>{t}</span>)}
                  {unknown > 0 && <button className="chip q" onClick={() => go(`/p/${id}/editar`)}>+ {unknown} por preencher</button>}
                </div>
                {hasNotes && <div className="note">{b.condo_admin ? `Administração: ${b.condo_admin}\n` : ''}{b.notes ?? ''}</div>}
              </>}
            </>
          })()}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <h2 style={{ margin: 0 }}>Localização</h2>
            {b.lat != null
              ? <button className="btn sec small" onClick={() => { setMoving(m => !m); setPosMsg('') }}>{moving ? 'Concluir' : 'Mover pino'}</button>
              : <button className="btn sec small" onClick={async () => {
                  const g = await geocode(b.street, b.number).catch(() => null)
                  if (!g) { setPosMsg('Não encontrei a morada. Edita o prédio e toca no mapa.'); return }
                  await setBuildingPosition(b.id, g.lat, g.lng); setF({ ...f, building: { ...b, ...g } }); setMoving(true)
                  setPosMsg('Localizado pela morada. Confirma: arrasta o pino para cima do prédio, se for preciso.')
                }}>Localizar</button>}
          </div>
          {moving && !posMsg && <div className="sub" style={{ marginTop: 6 }}>Arrasta o pino para cima do prédio. Grava sozinho ao largar.</div>}
          {posMsg && <div className="sub" style={{ marginTop: 6 }}>{posMsg}</div>}
          {b.lat != null && <MapView small pins={[{ id: b.id, lat: b.lat, lng: b.lng!, color: '#0f5c8c', label: b.number, title: '' }]}
            center={[b.lat, b.lng!]} draggableId={moving ? b.id : null}
            onDragEnd={async (_id, lat, lng) => {
              try { await setBuildingPosition(b.id, lat, lng); setF({ ...f, building: { ...b, lat, lng } }); setPosMsg('Posição gravada.') }
              catch (e) { setPosMsg('Não gravou: ' + (e as Error).message) }
            }} />}
          {b.lat == null && !posMsg && <div className="sub" style={{ marginTop: 6 }}>Sem posição: este prédio não aparece no mapa.</div>}
        </div>

      </main>
      <div className="fab">
        <button className="btn tonal" onClick={() => go(`/p/${id}/anuncio`)}>+ Anúncio</button>
        <button className="btn" onClick={() => go(`/p/${id}/visita`)}>+ Nova visita</button>
      </div>
      {open && <Detail ev={open} f={f} pieces={pieces} onClose={() => setOpen(null)}
        onDeleted={() => { setF(withoutEv(f, open)); setOpen(null) }}
        onSettled={() => getBuildingFull(id).then(setF).catch(e => setErr(e.message))} />}
    </>
  )
}

/** A ficha sem a visita ou o anúncio que se acabou de apagar (enquanto o "Anular" está no ecrã). */
export function withoutEv(f: BuildingFull, ev: Ev): BuildingFull {
  return ev.kind === 'visit'
    ? { ...f, visits: f.visits.filter(v => v.id !== ev.v.id), results: f.results.filter(r => r.visit_id !== ev.v.id) }
    : { ...f, listings: f.listings.filter(l => l.id !== ev.l.id), prices: f.prices.filter(p => p.listing_id !== ev.l.id) }
}

function visitLine(v: Visit, f: BuildingFull) {
  const rs = f.results.filter(r => r.visit_id === v.id)
  const talks = rs.filter(r => r.outcomes.includes('falei')).length
  const who = v.companion ? `com ${v.companion}` : v.origin === 'legado' ? '' : 'sozinho'
  return <>{[v.origin === 'legado' ? 'Legado' : 'Visita', who, rs.length ? `${rs.length} ${rs.length === 1 ? 'porta' : 'portas'}` : '', talks ? `${talks} ${talks === 1 ? 'conversa' : 'conversas'}` : ''].filter(Boolean).join(' · ')}
    {v.general_note && <div className="sub">{v.general_note}</div>}</>
}
function listingLine(l: Listing, f: BuildingFull) {
  const u = f.units.find(x => x.id === l.unit_id)
  const p = f.prices.filter(x => x.listing_id === l.id).sort((a, b) => b.at.localeCompare(a.at))[0]
  const who = l.advertiser_type === 'particular' ? 'FSBO' : l.advertiser || (l.advertiser_type === '?' ? 'anunciante ?' : l.advertiser_type)
  return <>Anúncio {l.operation === 'arrendamento' ? 'arrend.' : 'venda'} · {u?.label ?? l.floor_hint ?? 'andar ?'}{l.typology ? ` · ${l.typology}` : ''}{p ? ` · ${fmtPrice(p.price)}` : ''} · {who}{!l.active && <span className="sub"> · {listingState(l).toLowerCase()}</span>}</>
}

/** Resumo de uma visita ou de um anúncio (folha de baixo). Usado no histórico do prédio e na ficha da fração. */
/**
 * onDeleted: esconder já o que se apagou (a base só apaga passados uns segundos, com "Anular" no aviso).
 * onSettled: recarregar quando o apagar se concretiza ou é anulado.
 */
export function Detail({ ev, f, pieces, onClose, onDeleted, onSettled }: { ev: Ev; f: BuildingFull; pieces: Piece[]; onClose: () => void; onDeleted: () => void; onSettled: () => void }) {
  const bid = f.building.id
  const remove = () => {
    deleteWithUndo(ev.kind === 'visit' ? 'Visita apagada' : 'Anúncio apagado',
      () => ev.kind === 'visit' ? deleteVisit(ev.v.id) : deleteListing(ev.l), () => onSettled())
    onDeleted()
  }
  const what = ev.kind === 'visit' ? 'esta visita' : 'este anúncio'
  let body
  if (ev.kind === 'visit') {
    const v = ev.v
    const rs = f.results.filter(r => r.visit_id === v.id)
      .map(r => ({ r, u: f.units.find(u => u.id === r.unit_id) }))
      .sort((a, b) => f.units.indexOf(a.u!) - f.units.indexOf(b.u!))
    const notes = f.unitNotes.filter(n => n.visit_id === v.id)
    body = <>
      <b>{v.origin === 'legado' ? 'Visita (legado)' : 'Visita'} · {v.year_uncertain ? fmtDate(v.visited_at, true) + ' (ano a confirmar)' : fmtDateTime(v.visited_at)}</b>
      <div className="sub">{f.building.street}, {f.building.number}{v.companion ? ` · com ${v.companion}` : v.origin === 'legado' ? '' : ' · sozinho'}</div>
      {v.general_note && <div className="note">{v.general_note}</div>}
      {v.raw_text && <div className="note">Texto original: {v.raw_text}</div>}
      {rs.map(({ r, u }) => {
        const ints = f.interactions.filter(i => i.visit_id === v.id && i.unit_id === r.unit_id)
        return <div key={r.id} className="row" style={{ display: 'block' }}>
          <a href={`#/p/${bid}/f/${r.unit_id}`}><b>{u?.label}</b></a> <span className="sub">· {resultText(r, pieces)}</span>
          {r.note && <div className="sub">{r.note}</div>}
          {ints.map(i => {
            const p = f.people.find(x => x.id === i.person_id)
            const role = f.personUnits.find(pu => pu.person_id === i.person_id && pu.unit_id === r.unit_id)?.role
            return <div key={i.id} style={{ marginTop: 6 }}>
              {p && <a className="chip ok" href={`#/pessoa/${p.id}`} style={{ textDecoration: 'none' }}><Icon name="user" size={14} /> {p.name}{role ? ` · ${roleLabel(role)}` : ''} ›</a>}
              {i.notes && <div className="sub" style={{ marginTop: 4 }}>{i.notes}</div>}
            </div>
          })}
        </div>
      })}
      {!!notes.length && <><h2 style={{ marginTop: 14 }}>Disseram sobre outras frações</h2>
        {notes.map(n => <div key={n.id} className="row" style={{ display: 'block' }}><a href={`#/p/${bid}/f/${n.unit_id}`}>{f.units.find(u => u.id === n.unit_id)?.label}</a> <span className="sub">· {n.source ?? '?'}</span><div>{n.text}</div></div>)}</>}
      <button className="btn sec" style={{ width: '100%', marginTop: 12 }} onClick={() => go(`/p/${bid}/visita/${v.id}`)}>Reabrir e editar</button>
    </>
  } else {
    const l = ev.l
    const prices = f.prices.filter(p => p.listing_id === l.id).sort((a, b) => b.at.localeCompare(a.at))
    const rows: [string, string][] = [
      ['Fração', f.units.find(u => u.id === l.unit_id)?.label ?? l.floor_hint ?? '?'],
      ['Operação', l.operation === 'venda' ? 'Venda' : 'Arrendamento'],
      ['Tipologia · área', `${l.typology ?? '?'} · ${l.area_m2 ? l.area_m2 + ' m²' : '?'}`],
      ['Estado de conservação', l.condition ? condLabel(l.condition) : '?'],
      ['Anunciante', l.advertiser_type === 'particular' ? 'Particular (FSBO)' : `${l.advertiser ?? '?'}${l.advertiser_type !== '?' ? ` (${l.advertiser_type})` : ''}`],
      ['Exclusividade', l.exclusivity ?? '?'], ['Fonte', l.source ?? '?'], ['Estado', listingState(l)],
    ]
    body = <>
      <b>Anúncio · {fmtDate(l.first_seen, l.first_seen_uncertain)}</b>
      {rows.map(([k, val]) => <div className="row" key={k}><span className="sub">{k}</span><span>{val}</span></div>)}
      {(() => { const c = l.contact_person_id ? f.people.find(p => p.id === l.contact_person_id) : null
        return <div className="row"><span className="sub">Contacto</span>{c
          ? <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><a href={`#/pessoa/${c.id}`}>{c.name}</a>{c.phone && <a className="chip ok" href={`tel:${c.phone}`} style={{ textDecoration: 'none' }}>Ligar {c.phone}</a>}</span>
          : <span className="sub">— (Editar para escolher)</span>}</div> })()}
      <h2 style={{ marginTop: 12 }}>Preços</h2>
      {prices.map(p => <div className="row" key={p.id}><span className="sub">{fmtDate(p.at)}</span><span>{fmtPrice(p.price)}</span></div>)}
      {!prices.length && <div className="sub">Sem preço registado.</div>}
      {l.notes && <div className="note">{l.notes}</div>}
      {l.url && <div style={{ marginTop: 10 }}><a href={l.url} target="_blank" rel="noreferrer">Abrir anúncio ↗</a></div>}
      <button className="btn sec" style={{ width: '100%', marginTop: 12 }} onClick={() => go(`/p/${bid}/anuncio/${l.id}`)}>Editar · novo preço · retirar · vendido</button>
    </>
  }
  return <div className="sheet" onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="panel">{body}
      <button className="btn" style={{ width: '100%', marginTop: 14 }} onClick={onClose}>Fechar</button>
      <button className="linkbtn" style={{ color: 'var(--bad)', marginTop: 12 }} onClick={remove}>Apagar {what}</button>
      <div className="sub" style={{ marginTop: 4 }}>{ev.kind === 'visit'
        ? 'Leva os resultados por fração desta visita; pessoas e conversas ficam. Há uns segundos para anular.'
        : 'Leva o histórico de preços. Há uns segundos para anular.'}</div>
    </div>
  </div>
}
