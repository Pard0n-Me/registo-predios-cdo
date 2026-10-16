import { useState } from 'react'
import { supabase } from '../data/adapter'

export default function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    setBusy(true); setErr('')
    const { error } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } })
    setBusy(false)
    if (error) setErr(error.message); else setSent(true)
  }
  const verify = async () => {
    setBusy(true); setErr('')
    const { error } = await supabase!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setErr('Código inválido ou expirado.')
  }

  return (
    <main style={{ paddingTop: 60 }}>
      <h1 style={{ fontSize: 24 }}>Registo de Prédios</h1>
      <div className="card">
        <label className="f">Email</label>
        <input className="t" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} disabled={sent} />
        {!sent && <button className="btn" style={{ width: '100%', marginTop: 12 }} disabled={busy || !email} onClick={send}>Enviar código</button>}
        {sent && <>
          <label className="f">Código recebido por email</label>
          <input className="t" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} />
          <button className="btn" style={{ width: '100%', marginTop: 12 }} disabled={busy || code.length < 6} onClick={verify}>Entrar</button>
          <button className="linkbtn" style={{ marginTop: 8 }} onClick={() => { setSent(false); setCode('') }}>Usar outro email</button>
        </>}
        {err && <div className="err">{err}</div>}
      </div>
    </main>
  )
}
