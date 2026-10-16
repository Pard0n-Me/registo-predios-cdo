import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface Pin { id: string; lat: number; lng: number; color: string; label: string; title: string }

const CDO: [number, number] = [38.7180, -9.1660]

export default function MapView({ pins, onPin, onMapTap, center, small, locateSignal }: {
  pins: Pin[]
  onPin?: (id: string) => void
  onMapTap?: (lat: number, lng: number) => void
  center?: [number, number] | null
  small?: boolean
  locateSignal?: number
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const me = useRef<L.CircleMarker | null>(null)
  const tapRef = useRef(onMapTap)
  tapRef.current = onMapTap

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView(center ?? CDO, center ? 18 : 16)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap',
    }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    m.on('click', e => tapRef.current?.(e.latlng.lat, e.latlng.lng))
    m.on('locationfound', e => {
      me.current?.remove()
      me.current = L.circleMarker(e.latlng, { radius: 7, color: '#fff', weight: 3, fillColor: '#0f5c8c', fillOpacity: 1 }).addTo(m)
      m.setView(e.latlng, 18)
    })
    map.current = m
    return () => { m.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const g = layer.current
    if (!g) return
    g.clearLayers()
    for (const p of pins) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${p.color};color:#fff;border:2px solid #fff;border-radius:999px;min-width:26px;height:26px;padding:0 5px;display:flex;align-items:center;justify-content:center;font:700 11px/1 -apple-system,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.35)">${p.label}</div>`,
        iconSize: [26, 26], iconAnchor: [13, 13],
      })
      L.marker([p.lat, p.lng], { icon, title: p.title }).on('click', () => onPin?.(p.id)).addTo(g)
    }
  }, [pins, onPin])

  useEffect(() => { if (center && map.current) map.current.setView(center, 18) }, [center])
  useEffect(() => { if (locateSignal && map.current) map.current.locate({ enableHighAccuracy: true }) }, [locateSignal])

  return <div ref={el} className={'map' + (small ? ' small' : '')} />
}
