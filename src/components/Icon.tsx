// Ícones SVG de traço (estilo Lucide, 24×24, traço 2), em vez de emojis: iguais em todos os telefones e seguem a cor do texto.
const PATHS: Record<string, string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.8 2z',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0zM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  map: 'M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7 9 4zM9 4v13M15 7v13',
  list: 'M8 6h13M8 12h13M8 18h13M3.8 6h.01M3.8 12h.01M3.8 18h.01',
  tag: 'M3 12V4h8l10 10-8 8L3 12zM7.5 8.5h.01',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  minus: 'M5 12h14',
}

export default function Icon({ name, size = 18 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  )
}
