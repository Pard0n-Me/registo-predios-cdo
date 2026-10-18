import { useState } from 'react'
import { supabase } from '../data/adapter'

// Login por email + password: funciona dentro da app instalada no iPhone (o link mágico abriria o Safari)
// e não precisa de SMTP próprio na Supabase. A sessão fica guardada; só se volta a pedir se saíres.
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setErr(/invalid/i.test(error.message) ? 'Email ou password errados.' : error.message)
  }

  return (
    <main style={{ paddingTop: 60 }}>
      <h1 style={{ fontSize: 24 }}>Registo de Prédios</h1>
      <form className="card" onSubmit={submit}>
        <label className="f" htmlFor="email">Email</label>
        <input id="email" className="t" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} />
        <label className="f" htmlFor="pw">Password</label>
        <input id="pw" className="t" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="btn" style={{ width: '100%', marginTop: 14 }} disabled={busy || !email || !password}>{busy ? 'A entrar…' : 'Entrar'}</button>
        {err && <div className="err">{err}</div>}
      </form>
    </main>
  )
}
