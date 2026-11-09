import Icon from './Icon'

const TABS = [
  { path: '/', label: 'Mapa', icon: 'map' },
  { path: '/predios', label: 'Prédios', icon: 'list' },
  { path: '/anuncios', label: 'Anúncios', icon: 'tag' },
  { path: '/mais', label: 'Mais', icon: 'more' },
] as const

export default function TabBar({ path }: { path: string }) {
  return (
    <nav className="tabbar" aria-label="Navegação principal">
      {TABS.map(t => (
        <a key={t.path} href={'#' + t.path} aria-current={t.path === path ? 'page' : undefined}>
          <Icon name={t.icon} size={24} /><span>{t.label}</span>
        </a>
      ))}
    </nav>
  )
}
