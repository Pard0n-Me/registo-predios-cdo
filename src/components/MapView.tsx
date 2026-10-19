import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface Pin { id: string; lat: number; lng: number; color: string; label: string; title: string }

const CDO: [number, number] = [38.7180, -9.1660]
const PIN = 26          // diâmetro do pino em px
const NEAR = 22         // pinos a menos de 22 px uns dos outros são afastados em leque
const FAN = 18          // raio do leque em px

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

export default function MapView({ pins, onPin, onMapTap, center, small, locateSignal, draggableId, onDragEnd }: {
  pins: Pin[]
  onPin?: (id: string) => void
  onMapTap?: (lat: number, lng: number) => void
  center?: [number, number] | null
  small?: boolean
  locateSignal?: number
  /** O pino com este id pode ser arrastado; os outros não. */
  draggableId?: string | null
  onDragEnd?: (id: string, lat: number, lng: number) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const me = useRef<L.CircleMarker | null>(null)
  const props = useRef({ pins, onPin, onMapTap, draggableId, onDragEnd })
  props.current = { pins, onPin, onMapTap, draggableId, onDragEnd }

  const draw = () => {
    const m = map.current, g = layer.current
    if (!m || !g) return
    g.clearLayers()
    const { pins, onPin, draggableId, onDragEnd } = props.current
    const off = fanOffsets(m, pins.filter(p => p.id !== draggableId))
    for (const p of pins) {
      const drag = p.id === draggableId
      const [dx, dy] = off.get(p.id) ?? [0, 0]
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${p.color};color:#fff;border:2px solid #fff;border-radius:999px;min-width:${PIN}px;height:${PIN}px;padding:0 5px;display:flex;align-items:center;justify-content:center;font:700 11px/1 -apple-system,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.35)${drag ? ';outline:3px solid rgba(15,92,140,.35);cursor:grab' : ''}">${p.label}</div>`,
        iconSize: [PIN, PIN], iconAnchor: [PIN / 2 - dx, PIN / 2 - dy],
      })
      const mk = L.marker([p.lat, p.lng], { icon, title: p.title, draggable: drag, autoPan: drag, zIndexOffset: drag ? 1000 : 0 })
      mk.on('click', () => onPin?.(p.id))
      if (drag) mk.on('dragend', () => { const ll = mk.getLatLng(); onDragEnd?.(p.id, ll.lat, ll.lng) })
      mk.addTo(g)
    }
  }

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView(center ?? CDO, center ? 18 : 16)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap',
    }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    m.on('click', e => props.current.onMapTap?.(e.latlng.lat, e.latlng.lng))
    m.on('zoomend', draw)
    m.on('locationfound', e => {
      me.current?.remove()
      me.current = L.circleMarker(e.latlng, { radius: 7, color: '#fff', weight: 3, fillColor: '#0f5c8c', fillOpacity: 1 }).addTo(m)
      m.setView(e.latlng, 18)
    })
    map.current = m
    draw()
    return () => { m.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw, [pins, onPin, draggableId])
  useEffect(() => { if (center && map.current) map.current.setView(center, Math.max(map.current.getZoom(), 18)) }, [center])
  useEffect(() => { if (locateSignal && map.current) map.current.locate({ enableHighAccuracy: true }) }, [locateSignal])

  return <div ref={el} className={'map' + (small ? ' small' : '')} />
}
