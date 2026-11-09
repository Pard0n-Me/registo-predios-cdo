import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon'
import Reload from '../components/Reload'
import { ADVERTISER, listActiveSaleAds, type AdRow } from '../data/anuncios'
import { norm } from '../data/store'
import type { Listing } from '../types'
import { agoText, fmtPrice, go } from '../ui'

type Who = 'todos' | Listing['advertiser_type']
const WHO: [Who, string][] = [['todos', 'Todos'], ['particular', 'Particular'], ['agencia', 'Agência'], ['promotor', 'Promotor']]
type Sort = 'recente' | 'preco' | 'rua'
const SORTS: [Sort, string][] = [['recente', 'Mais recentes'], ['preco', 'Preço (menor primeiro)'], ['rua', 'Rua (A–Z)']]

const byStreet = (a: AdRow, b: AdRow) =>
  a.street.localeCompare(b.street, 'pt') || a.number.localeCompare(b.number, 'pt', { numeric: true })

export default function AnunciosPage() {
  const [rows, setRows] = useState<AdRow[] | null>(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [who, setWho] = useState<Who>('todos')
  const [sort, setSort] = useState<Sort>('recente')
  useEffect(() => { listActiveSaleAds().then(setRows).catch(e => setErr(String(e.message ?? e))) }, [])
  const open = (id: string) => go(`/p/${id}`)

  const shown = useMemo(() => {
    const nq = norm(q)
    const list = (rows ?? [])
      .filter(r => !nq || norm(`${r.street} ${r.number}`).includes(nq))
      .filter(r => who === 'todos' || r.listing.advertiser_type === who)
    const cmp: Record<Sort, (a: AdRow, b: AdRow) => number> = {
      recente: (a, b) => b.at.localeCompare(a.at) || byStreet(a, b),
      // sem preço fica no fim
      preco: (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || byStreet(a, b),
      rua: byStreet,
    }
    return [...list].sort(cmp[sort])
  }, [rows, q, who, sort])

  return (
    <>
      <header className="top"><h1>Anúncios</h1><Reload /></header>
      <main>
        <div className="search"><Icon name="search" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Rua e número, ex.: correia teles 90" aria-label="Pesquisar anúncio" autoCapitalize="off" autoCorrect="off" enterKeyHint="search" />{q && <button className="linkbtn iconbtn" aria-label="Limpar pesquisa" onClick={() => setQ('')}><Icon name="x" /></button>}</div>
        {err && <div className="err">{err} <button className="linkbtn" onClick={() => location.reload()}>Tentar outra vez</button></div>}
        {!rows && !err && <div className="sub">A carregar…</div>}
        {rows && !rows.length && <div className="card"><div className="sub">Sem anúncios de venda ativos.</div></div>}
        {rows && !!rows.length && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <h2 style={{ margin: 0 }}>Anúncios de venda ativos ({shown.length}{shown.length !== rows.length ? ` de ${rows.length}` : ''})</h2>
              <select className="t" style={{ width: 'auto', padding: '6px 8px', fontSize: 14 }} aria-label="Ordenar anúncios" value={sort} onChange={e => setSort(e.target.value as Sort)}>
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="seg scroll-x" role="group" aria-label="Filtrar anúncios" style={{ marginBottom: 4 }}>
              {WHO.map(([v, l]) => <button key={v} className={'chip filt' + (who === v ? ' on' : '')} aria-pressed={who === v} onClick={() => setWho(v)}>{l}</button>)}
            </div>
            {!shown.length && <div className="sub" style={{ marginTop: 8 }}>Nenhum anúncio com este filtro.</div>}
            {shown.map(r => (
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
