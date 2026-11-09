import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface Pin {
  id: string; lat: number; lng: number; color: string; label: string; title: string
  /** Nome para leitores de ecrã. Se faltar, usa o título. */
  aria?: string
  /** No modo de pontos, "venda" desenha um alfinete maior. */
  shape?: 'dot' | 'venda'
  /** A última visita é de hoje: o pino leva um visto. */
  today?: boolean
}
export interface MapViewState { center: [number, number]; zoom: number }

const CDO: [number, number] = [38.7180, -9.1660]
const PIN = 26          // diâmetro do círculo numerado em px
const HIT = 44          // área de toque de cada pino em px
const NEAR = 22         // pinos a menos de 22 px uns dos outros são afastados em leque
const FAN = 18          // raio do leque em px
/** A partir deste zoom os pinos mostram o número da porta; abaixo disso são pontos. Valor de partida: acertar no iPhone. */
export const NUMBER_ZOOM = 17

/** Desvio em px para cada pino, para que pinos coincidentes ou muito próximos não se tapem. */
function fanOffsets(m: L.Map, pins: Pin[]): Map<string, [number, number]> {
  const pts = pins.map(p => ({ p, xy: m.latLngToLayerPoint([p.lat, p.lng]) }))
  const out = new Map<string, [number, number]>()
  const used = new Set<string>()
  for (const a of pts) {
    if (used.has(a.p.id)) continue
    const group = pts.filter(b => !used.has(b.p.id) && a.xy.distanceTo(b.xy) < NEAR)
    group.forEach(g => used.add(g.p.id))
    if (group.length < 2) { out.set(a.p.id, [0, 0]); continue }
    group.sort((x, y) => x.p.label.localeCompare(y.p.label, 'pt', { numeric: true }))
    // o raio cresce com o número de pinos, para caberem lado a lado à volta do círculo
    const radius = Math.max(FAN, Math.ceil((group.length * (PIN + 4)) / (2 * Math.PI)))
    group.forEach((g, i) => {
      const ang = -Math.PI / 2 + (2 * Math.PI * i) / group.length
      out.set(g.p.id, [Math.round(radius * Math.cos(ang)), Math.round(radius * Math.sin(ang))])
    })
  }
  return out
}

const CHECK = '<svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><path d="M20 6 9 17l-5-5" fill="none" stroke="#2f7d4f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const badge = (top: number, right: number) =>
  `<span style="position:absolute;top:${top}px;right:${right}px;width:14px;height:14px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 1px rgba(0,0,0,.25)">${CHECK}</span>`

/** Ponto pequeno, ou alfinete para "À venda". Área de toque de 44 px. */
function dotIcon(p: Pin, selected: boolean): L.DivIcon {
  const venda = p.shape === 'venda'
  const glow = selected ? ' style="filter:drop-shadow(0 0 5px rgba(15,92,140,.9))"' : ''
  const halo = selected ? ';outline:6px solid rgba(15,92,140,.28)' : ''
  const inner = venda
    ? `<svg viewBox="-12 -30 24 34" width="24" height="32" aria-hidden="true"${glow}><path d="M0 3C0 3-10-5.5-10-12a10 10 0 0 1 20 0C10-5.5 0 3 0 3Z" fill="${p.color}" stroke="#fff" stroke-width="2"/><circle cy="-12" r="3.5" fill="#fff"/></svg>`
    : `<span style="width:14px;height:14px;border-radius:50%;background:${p.color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)${halo}"></span>`
  return L.divIcon({
    className: '', iconSize: [HIT, HIT], iconAnchor: [HIT / 2, venda ? 37 : HIT / 2],
    html: `<div style="position:relative;width:${HIT}px;height:${HIT}px;display:flex;align-items:center;justify-content:center">${inner}${p.today ? badge(venda ? 4 : 9, venda ? 8 : 9) : ''}</div>`,
  })
}

/** Círculo numerado (o de sempre), agora dentro de uma área de toque de 44 px. */
function numberIcon(p: Pin, selected: boolean, drag: boolean, dx: number, dy: number): L.DivIcon {
  const ring = drag ? ';outline:3px solid rgba(15,92,140,.35);cursor:grab' : selected ? ';outline:6px solid rgba(15,92,140,.28)' : ''
  return L.divIcon({
    className: '', iconSize: [HIT, HIT], iconAnchor: [HIT / 2 - dx, HIT / 2 - dy],
    html: `<div style="width:${HIT}px;height:${HIT}px;display:flex;align-items:center;justify-content:center"><div style="position:relative;background:${p.color};color:#fff;border:2px solid #fff;border-radius:999px;min-width:${PIN}px;height:${PIN}px;padding:0 5px;display:flex;align-items:center;justify-content:center;font:700 11px/1 -apple-system,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.35)${ring}">${p.label}${p.today ? badge(-6, -6) : ''}</div></div>`,
  })
}

export default function MapView({ pins, onPin, onMapTap, center, small, fill, locateSignal, draggableId, onDragEnd, adaptive, selectedId, initialView, onViewChange }: {
  pins: Pin[]
  onPin?: (id: string) => void
  onMapTap?: (lat: number, lng: number) => void
  center?: [number, number] | null
  small?: boolean
  /** O mapa ocupa todo o contentor (posição absoluta). */
  fill?: boolean
  locateSignal?: number
  /** O pino com este id pode ser arrastado; os outros não. */
  draggableId?: string | null
  onDragEnd?: (id: string, lat: number, lng: number) => void
  /** Pontos com zoom afastado, círculos numerados a partir de NUMBER_ZOOM. */
  adaptive?: boolean
  /** Pino destacado (cartão aberto). */
  selectedId?: string | null
  /** Vista com que o mapa abre (só se lê ao montar). */
  initialView?: MapViewState
  onViewChange?: (v: MapViewState) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const me = useRef<L.CircleMarker | null>(null)
  const props = useRef({ pins, onPin, onMapTap, draggableId, onDragEnd, adaptive, selectedId, initialView, onViewChange })
  props.current = { pins, onPin, onMapTap, draggableId, onDragEnd, adaptive, selectedId, initialView, onViewChange }

  const draw = () => {
    const m = map.current, g = layer.current
    if (!m || !g) return
    g.clearLayers()
    const { pins, onPin, draggableId, onDragEnd, adaptive, selectedId } = props.current
    const dots = !!adaptive && m.getZoom() < NUMBER_ZOOM
    const off = dots ? new Map<string, [number, number]>() : fanOffsets(m, pins.filter(p => p.id !== draggableId))
    for (const p of pins) {
      const drag = p.id === draggableId
      const sel = p.id === selectedId
      const [dx, dy] = off.get(p.id) ?? [0, 0]
      const icon = dots ? dotIcon(p, sel) : numberIcon(p, sel, drag, dx, dy)
      const mk = L.marker([p.lat, p.lng], { icon, title: p.title, draggable: drag, autoPan: drag, zIndexOffset: drag || sel ? 1000 : 0 })
      mk.on('click', () => onPin?.(p.id))
      if (drag) mk.on('dragend', () => { const ll = mk.getLatLng(); onDragEnd?.(p.id, ll.lat, ll.lng) })
      mk.addTo(g)
      const node = mk.getElement()
      if (node) { node.setAttribute('role', 'button'); node.setAttribute('aria-label', p.aria || p.title || p.label) }
    }
  }

  useEffect(() => {
    if (!el.current || map.current) return
    const start = props.current.initialView
    const m = L.map(el.current, { zoomControl: false, attributionControl: true })
      .setView(start ? start.center : (center ?? CDO), start ? start.zoom : (center ? 18 : 16))
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap',
    }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    m.on('click', e => props.current.onMapTap?.(e.latlng.lat, e.latlng.lng))
    m.on('zoomend', draw)
    m.on('moveend', () => { const c = m.getCenter(); props.current.onViewChange?.({ center: [c.lat, c.lng], zoom: m.getZoom() }) })
    m.on('locationfound', e => {
      me.current?.remove()
      me.current = L.circleMarker(e.latlng, { radius: 7, color: '#fff', weight: 3, fillColor: '#0f5c8c', fillOpacity: 1 }).addTo(m)
      m.setView(e.latlng, 18)
    })
    map.current = m
    draw()
    // O mapa em altura total tem de recalcular o tamanho quando o contentor muda (risco 1 da especificação).
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current)
    return () => { ro.disconnect(); m.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw, [pins, onPin, draggableId, selectedId, adaptive])
  useEffect(() => { if (center && map.current) map.current.setView(center, Math.max(map.current.getZoom(), 18)) }, [center])
  useEffect(() => { if (locateSignal && map.current) map.current.locate({ enableHighAccuracy: true }) }, [locateSignal])

  return <div ref={el} className={'map' + (small ? ' small' : '') + (fill ? ' fill' : '')} />
}
