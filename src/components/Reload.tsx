import Icon from './Icon'
// A app instalada no iPhone não tem botão de recarregar: este repõe os dados do servidor.
export default function Reload() {
  return <button className="linkbtn reload" aria-label="Recarregar" title="Recarregar" onClick={() => location.reload()}><Icon name="refresh" size={20} /></button>
}
