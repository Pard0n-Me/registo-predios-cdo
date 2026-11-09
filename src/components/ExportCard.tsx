import { useState } from 'react'
import { buildExports, download } from '../data/export'

export default function ExportCard() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const run = async (which: 'fracoes' | 'visitas' | 'anuncios') => {
    setBusy(true); setMsg('')
    try {
      const x = await buildExports()
      download(`registo-predios-${which}-${new Date().toISOString().slice(0, 10)}.csv`, x[which])
      setMsg(`${x.counts[which]} linhas exportadas.`)
    } catch (e) { setMsg('Não exportou: ' + (e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="card">
      <h2>Exportar para Excel</h2>
      <div className="seg">
        <button className="btn sec small" disabled={busy} onClick={() => run('fracoes')}>Prédios e frações</button>
        <button className="btn sec small" disabled={busy} onClick={() => run('visitas')}>Visitas</button>
        <button className="btn sec small" disabled={busy} onClick={() => run('anuncios')}>Anúncios</button>
      </div>
      <div className="sub" style={{ marginTop: 6 }}>{msg || 'Ficheiros CSV que abrem no Excel ou no Numbers. Têm contactos: guarda-os só para ti.'}</div>
    </div>
  )
}
