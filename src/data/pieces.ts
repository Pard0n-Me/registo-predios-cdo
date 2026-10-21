// Peças de marketing (postal, bloco, flyers…): lista gerida pelo António na app.
import { useEffect, useState } from 'react'
import { db } from './adapter'
import type { Piece } from '../types'

const KEY = 'pecas-cache-v1'
let cache: Piece[] | null = null
const bySort = (a: Piece, b: Piece) => a.sort - b.sort || a.name.localeCompare(b.name, 'pt')
const stored = (): Piece[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] } }

/** Todas as peças, ativas e arquivadas. Guarda uma cópia no telefone para as miniaturas aparecerem sem rede. */
export async function getPieces(force = false): Promise<Piece[]> {
  if (cache && !force) return cache
  try {
    cache = (await db.all<Piece>('marketing_pieces')).sort(bySort)
    try { localStorage.setItem(KEY, JSON.stringify(cache)) } catch { /* sem armazenamento */ }
  } catch { cache ??= stored() }  // sem rede, ou tabela ainda por criar
  return cache
}

export function usePieces(): Piece[] {
  const [p, setP] = useState<Piece[]>(() => cache ?? stored())
  useEffect(() => { getPieces().then(setP) }, [])
  return p
}

export async function savePiece(p: Partial<Piece> & { name: string; short_name: string }): Promise<Piece> {
  const { id, ...data } = p
  const saved = id ? await db.update<Piece>('marketing_pieces', id, data) : await db.insert<Piece>('marketing_pieces', data)
  cache = null
  return saved
}

/** Troca a ordem de duas peças. */
export async function swapPieces(a: Piece, b: Piece) {
  await db.update('marketing_pieces', a.id, { sort: b.sort })
  await db.update('marketing_pieces', b.id, { sort: a.sort === b.sort ? a.sort + 1 : a.sort })
  cache = null
}

/** Reduz uma imagem a uma miniatura leve (JPEG, lado maior 240 px). */
export async function makeThumb(file: File, max = 240): Promise<string> {
  const img = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height)
  g.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.75)
}
