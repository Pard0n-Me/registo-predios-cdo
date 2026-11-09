import ExportCard from '../components/ExportCard'
import Reload from '../components/Reload'
import { go } from '../ui'

export default function MaisPage() {
  return (
    <>
      <header className="top"><h1>Mais</h1><Reload /></header>
      <main>
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div><h2 style={{ margin: 0 }}>Peças de marketing</h2><div className="sub">Postais, blocos, flyers… os botões da visita.</div></div>
          <button className="btn sec small" onClick={() => go('/pecas')}>Gerir</button>
        </div>
        <ExportCard />
      </main>
    </>
  )
}
