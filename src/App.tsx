import Toast from './components/Toast'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { db, resetDemo, supabase } from './data/adapter'
import Home from './pages/Home'
import BuildingPage from './pages/BuildingPage'
import BuildingForm from './pages/BuildingForm'
import VisitPage from './pages/VisitPage'
import UnitPage from './pages/UnitPage'
import PersonPage from './pages/PersonPage'
import ListingForm from './pages/ListingForm'
import Login from './pages/Login'
import PiecesPage from './pages/PiecesPage'

function useHash() {
  const [h, setH] = useState(location.hash.slice(1) || '/')
  useEffect(() => {
    const on = () => { setH(location.hash.slice(1) || '/'); scrollTo(0, 0) }
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return h
}

function route(hash: string) {
  const [path, qs] = hash.split('?')
  const q = new URLSearchParams(qs)
  const p = path.split('/').filter(Boolean).map(decodeURIComponent)
  if (p[0] === 'novo') return <BuildingForm initial={{ street: q.get('street') ?? '', number: q.get('number') ?? '' }} />
  if (p[0] === 'pecas') return <PiecesPage />
  if (p[0] === 'pessoa' && p[1]) return <PersonPage key={p[1]} id={p[1]} />
  if (p[0] === 'p' && p[1]) {
    const id = p[1]
    if (p[2] === 'editar') return <BuildingForm key={'e' + id} id={id} />
    if (p[2] === 'visita') return <VisitPage key={'v' + id + (p[3] ?? '')} id={id} visitId={p[3]} />
    if (p[2] === 'f' && p[3]) return <UnitPage key={p[3]} buildingId={id} unitId={p[3]} />
    if (p[2] === 'anuncio') return <ListingForm key={'l' + (p[3] ?? 'novo')} buildingId={id} listingId={p[3]} unitId={q.get('unit') ?? undefined} />
    return <BuildingPage key={id} id={id} />
  }
  return <Home />
}

export default function App() {
  const hash = useHash()
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  // Publicada sem as variáveis da Supabase: não deixa gravar em modo demonstração por engano.
  const misconfigured = db.demo && !['localhost', '127.0.0.1'].includes(location.hostname) && !location.search.includes('demo')
  if (misconfigured) return (
    <div className="phone"><main style={{ paddingTop: 60 }}>
      <h1 style={{ fontSize: 22 }}>Registo de Prédios</h1>
      <div className="card"><b>Falta ligar esta publicação à Supabase.</b>
        <div className="note">Na Vercel: Settings › Environment Variables › VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. Depois: Deployments › Redeploy. Nada foi gravado.</div></div>
    </main></div>
  )

  return (
    <div className="phone">
      {db.demo && <div className="banner">Modo demonstração · dados fictícios só neste aparelho · <button className="linkbtn" style={{ color: '#fff', fontSize: 12, textDecoration: 'underline' }} onClick={resetDemo}>repor</button></div>}
      <Toast />
      {supabase && session === undefined ? null : supabase && !session ? <Login /> : route(hash)}
    </div>
  )
}
