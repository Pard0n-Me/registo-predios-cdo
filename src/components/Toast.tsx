import { useEffect, useState } from 'react'
import Icon from './Icon'

// Aviso breve depois de gravar ("Visita gravada"). Sobrevive à mudança de ecrã.
const KEY = 'aviso'
export function flash(msg: string) {
  try { sessionStorage.setItem(KEY, msg) } catch { /* ignora */ }
  dispatchEvent(new Event('aviso'))
}

/**
 * Apagar com "Anular": o ecrã esconde logo o que se apagou, mas a base só é apagada passados `ms`
 * (ou antes, se a app for para segundo plano ou houver outro apagar). Tocar em "Anular" cancela tudo.
 * Se a app for fechada antes disso, não se apaga nada (o erro é sempre o mais seguro).
 */
type Pending = { msg: string; run: () => Promise<unknown>; after: (ok: boolean, err?: string) => void; timer: number }
let pending: Pending | null = null
const UNDO_MS = 6000

async function commit() {
  const p = pending
  if (!p) return
  pending = null; clearTimeout(p.timer); dispatchEvent(new Event('aviso-anular'))
  try { await p.run(); p.after(true) }
  catch (e) { const m = (e as Error).message; flash('Não apagou: ' + m); p.after(false, m) }
}

export function deleteWithUndo(msg: string, run: () => Promise<unknown>, after: (ok: boolean, err?: string) => void) {
  if (pending) void commit()
  pending = { msg, run, after, timer: window.setTimeout(() => void commit(), UNDO_MS) }
  dispatchEvent(new Event('aviso-anular'))
}

function undo() {
  const p = pending
  if (!p) return
  pending = null; clearTimeout(p.timer)
  dispatchEvent(new Event('aviso-anular'))
  p.after(false)
  flash('Anulado: nada foi apagado')
}

if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void commit() })

export default function Toast() {
  const [msg, setMsg] = useState('')
  const [undoMsg, setUndoMsg] = useState('')
  useEffect(() => {
    let t: number | undefined
    const show = () => {
      let m = ''
      try { m = sessionStorage.getItem(KEY) ?? ''; sessionStorage.removeItem(KEY) } catch { /* ignora */ }
      if (!m) return
      setMsg(m); clearTimeout(t); t = window.setTimeout(() => setMsg(''), 2600)
    }
    const showUndo = () => setUndoMsg(pending?.msg ?? '')
    show()
    addEventListener('aviso', show); addEventListener('hashchange', show); addEventListener('aviso-anular', showUndo)
    return () => { removeEventListener('aviso', show); removeEventListener('hashchange', show); removeEventListener('aviso-anular', showUndo); clearTimeout(t) }
  }, [])
  if (undoMsg) return <div className="toast show undo" role="status" aria-live="polite">
    <Icon name="check" size={18} /> {undoMsg}
    <button className="toast-btn" onClick={undo}>Anular</button>
  </div>
  return <div className={'toast' + (msg ? ' show' : '')} role="status" aria-live="polite">{msg && <><Icon name="check" size={18} /> {msg}</>}</div>
}
