import { flash } from '../components/Toast'
import { useEffect, useState } from 'react'
import { getPieces, makeThumb, savePiece, swapPieces } from '../data/pieces'
import type { Piece } from '../types'
import { go } from '../ui'

/** Peças de marketing: acrescentar, editar, ordenar e arquivar (nunca apagar: o histórico das visitas aponta para elas). */
export default function PiecesPage() {
  const [list, setList] = useState<Piece[] | null>(null)
  const [err, setErr] = useState('')
  const [edit, setEdit] = useState<Partial<Piece> | null>(null)
  const load = () => getPieces(true).then(setList).catch(e => setErr(e.message))
  useEffect(() => { load() }, [])
  if (!list) return <main>{err ? <div className="err">{err}</div> : <div className="sub" style={{ padding: 20 }}>A carregar…</div>}</main>
  const active = list.filter(p => p.active), archived = list.filter(p => !p.active)
  const move = async (i: number, d: number) => { const a = active[i], b = active[i + d]; if (!b) return; await swapPieces(a, b); load() }
  const toggle = async (p: Piece) => { await savePiece({ ...p, active: !p.active }); flash(p.active ? 'Peça arquivada' : 'Peça ativa'); load() }

  return (
    <>
      <header className="top"><button className="linkbtn" onClick={() => go('/')}>‹ Início</button><h1>Peças de marketing</h1>
        <button className="linkbtn" onClick={() => setEdit({ name: '', short_name: '', active: true, sort: (list.at(-1)?.sort ?? 0) + 1 })}>+ Peça</button></header>
      <main>
        <div className="card">
          <h2>Ativas ({active.length})</h2>
          <div className="sub">São os botões da visita, por esta ordem.</div>
          {active.map((p, i) => <Row key={p.id} p={p} onEdit={() => setEdit(p)} extra={<>
            <button className="chip" aria-label="Subir" disabled={!i} onClick={() => move(i, -1)}>↑</button>
            <button className="chip" aria-label="Descer" disabled={i === active.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button className="chip" onClick={() => toggle(p)}>Arquivar</button></>} />)}
          {!active.length && <div className="sub" style={{ marginTop: 8 }}>Ainda não há peças. Toca em “+ Peça”.</div>}
        </div>
        {!!archived.length && <div className="card">
          <h2>Arquivadas ({archived.length})</h2>
          <div className="sub">Não aparecem na visita; continuam no histórico.</div>
          {archived.map(p => <Row key={p.id} p={p} onEdit={() => setEdit(p)} extra={<button className="chip" onClick={() => toggle(p)}>Reativar</button>} />)}
        </div>}
      </main>
      {edit && <Editor value={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

function Row({ p, onEdit, extra }: { p: Piece; onEdit: () => void; extra: React.ReactNode }) {
  return (
    <div className="row" style={{ gap: 10 }}>
      <button className="linkbtn" style={{ display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left', flex: 1, minWidth: 0 }} onClick={onEdit}>
        {p.thumb ? <img className="pthumb" src={p.thumb} alt="" /> : <span className="pthumb" />}
        <span style={{ minWidth: 0 }}><b style={{ color: 'var(--ink)' }}>{p.short_name}</b><div className="sub">{p.name}</div></span>
      </button>
      <div style={{ display: 'flex', gap: 4, flex: 'none' }}>{extra}</div>
    </div>
  )
}

function Editor({ value, onClose, onSaved }: { value: Partial<Piece>; onClose: () => void; onSaved: () => void }) {
  const [p, setP] = useState(value)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const pick = async (f: File | undefined) => {
    if (!f) return
    try { setP(x => ({ ...x, thumb: null })); const t = await makeThumb(f); setP(x => ({ ...x, thumb: t })) }
    catch { setErr('Não consegui ler a imagem. Usa uma foto ou um JPG/PNG (PDF não serve).') }
  }
  const save = async () => {
    if (!p.name?.trim() || !p.short_name?.trim()) { setErr('Falta o nome e o texto do botão.'); return }
    setBusy(true); setErr('')
    try { await savePiece({ ...p, name: p.name.trim(), short_name: p.short_name.trim() }); flash(p.id ? 'Peça atualizada' : 'Peça criada'); onSaved() }
    catch (e) { const m = (e as Error).message; setErr(/marketing_pieces/.test(m) ? 'Falta criar a tabela na Supabase: corre supabase/migracoes/2026-10-21-pecas-marketing.sql no SQL Editor.' : m); setBusy(false) }
  }
  return (
    <div className="sheet" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="panel">
        <b>{p.id ? 'Editar peça' : 'Nova peça'}</b>
        <label className="f" htmlFor="pc-name">Nome</label>
        <input id="pc-name" className="t" value={p.name ?? ''} placeholder="ex.: Postal Posicionamento 2024" onChange={e => setP({ ...p, name: e.target.value })} />
        <label className="f" htmlFor="pc-short">Texto do botão</label>
        <input id="pc-short" className="t" value={p.short_name ?? ''} placeholder="ex.: Postal" maxLength={18} onChange={e => setP({ ...p, short_name: e.target.value })} />
        <label className="f" htmlFor="pc-img">Imagem</label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {p.thumb ? <img className="pthumb" src={p.thumb} alt="" /> : <span className="pthumb" />}
          <input id="pc-img" type="file" accept="image/*" onChange={e => pick(e.target.files?.[0])} />
        </div>
        <div className="sub" style={{ marginTop: 4 }}>Fica guardada uma miniatura leve; o original não sai do telefone.</div>
        {err && <div className="err">{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="btn sec" onClick={onClose}>Cancelar</button>
          <button className="btn" disabled={busy} onClick={save}>{busy ? 'A gravar…' : 'Gravar'}</button>
        </div>
      </div>
    </div>
  )
}
