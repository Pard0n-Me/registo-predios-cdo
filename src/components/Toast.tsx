import { useEffect, useState } from 'react'
import Icon from './Icon'

// Aviso breve depois de gravar ("Visita gravada"). Sobrevive à mudança de ecrã.
const KEY = 'aviso'
export function flash(msg: string) {
  try { sessionStorage.setItem(KEY, msg) } catch { /* ignora */ }
  dispatchEvent(new Event('aviso'))
}

export default function Toast() {
  const [msg, setMsg] = useState('')
  useEffect(() => {
    let t: number | undefined
    const show = () => {
      let m = ''
      try { m = sessionStorage.getItem(KEY) ?? ''; sessionStorage.removeItem(KEY) } catch { /* ignora */ }
      if (!m) return
      setMsg(m); clearTimeout(t); t = window.setTimeout(() => setMsg(''), 2600)
    }
    show()
    addEventListener('aviso', show); addEventListener('hashchange', show)
    return () => { removeEventListener('aviso', show); removeEventListener('hashchange', show); clearTimeout(t) }
  }, [])
  return <div className={'toast' + (msg ? ' show' : '')} role="status" aria-live="polite">{msg && <><Icon name="check" size={18} /> {msg}</>}</div>
}
