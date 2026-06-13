'use client'

import { useActionState, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { addDiaryEntry } from '@/lib/actions/diary'
import type { FoodResult } from '@/lib/actions/foods'

const MEALS = [
  { value: 'breakfast', label: '🌅 Desayuno' },
  { value: 'lunch', label: '🥗 Comida' },
  { value: 'dinner', label: '🌙 Cena' },
  { value: 'snack', label: '🍎 Snack' },
]

export default function AddDiaryEntryPage() {
  const params = useSearchParams()
  const router = useRouter()
  const [state, action, pending] = useActionState(addDiaryEntry, null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<FoodResult[]>([])
  const [selected, setSelected] = useState<FoodResult | null>(null)
  const [qty, setQty] = useState('')

  const today = new Date().toISOString().slice(0, 10)
  const date = params.get('date') ?? today
  const defaultMeal = (params.get('meal') as string) ?? 'breakfast'

  const search = useCallback(async (val: string) => {
    setQ(val)
    if (val.length < 2) { setResults([]); return }
    const res = await fetch(`/api/foods?q=${encodeURIComponent(val)}`)
    const data = await res.json()
    setResults(data)
  }, [])

  const previewKcal = selected && qty ? Math.round((selected.kcalPer100g * parseFloat(qty)) / 100) : null

  if (state?.success) {
    router.push('/diary?date=' + date)
    return null
  }

  return (
    <div className="page-no-nav" style={{ paddingTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Link href="/diary" className="btn btn-ghost" style={{ width: 40, height: 40, minHeight: 40, padding: 0, fontSize: '1.2rem' }}>‹</Link>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Añadir alimento</h1>
      </div>

      {state?.error && <div className="alert alert-error">{state.error}</div>}

      {!selected ? (
        <>
          <div className="search-wrap">
            <span className="search-icon">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
              </svg>
            </span>
            <input
              type="search"
              className="search-input"
              placeholder="Buscar alimento…"
              value={q}
              onChange={(e) => search(e.target.value)}
              autoFocus
            />
          </div>

          {results.length > 0 && (
            <div>
              {results.map((food) => (
                <button key={food.id} className="food-card" style={{ width: '100%', textAlign: 'left' }} onClick={() => { setSelected(food); setQty(String(food.servingG)) }}>
                  <div>
                    <div className="food-card-name">{food.name}</div>
                    <div className="food-card-meta">
                      P:{food.proteinG}g · HC:{food.carbsG}g · G:{food.fatG}g por 100g
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="food-card-kcal">{food.kcalPer100g} kcal</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>por 100g</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {q.length >= 2 && results.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🔍</div>
              <div>No encontrado</div>
              <Link href="/foods/add" style={{ color: 'var(--green-dark)', fontWeight: 600, fontSize: '0.9rem', display: 'block', marginTop: 8 }}>
                + Crear alimento personalizado
              </Link>
            </div>
          )}

          {q.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>🥦</div>
              <div style={{ fontSize: '0.9rem' }}>Escribe al menos 2 letras para buscar</div>
              <Link href="/foods/add" style={{ color: 'var(--green-dark)', fontWeight: 600, fontSize: '0.9rem', display: 'block', marginTop: 12 }}>
                + Añadir alimento nuevo
              </Link>
            </div>
          )}
        </>
      ) : (
        <form action={action}>
          <input type="hidden" name="foodId" value={selected.id} />
          <input type="hidden" name="date" value={date} />

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selected.name}</div>
                {selected.brand && <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{selected.brand}</div>}
              </div>
              <button type="button" onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.3rem', padding: '0 4px' }}>×</button>
            </div>
            {previewKcal !== null && (
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--green-dark)' }}>{previewKcal}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>kcal</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>
                  P:{Math.round(selected.proteinG * parseFloat(qty||'0') / 100)}g · HC:{Math.round(selected.carbsG * parseFloat(qty||'0') / 100)}g · G:{Math.round(selected.fatG * parseFloat(qty||'0') / 100)}g
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Cantidad (g)</label>
            <input
              type="number"
              name="quantityG"
              className="form-input"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              min="1"
              step="1"
              required
              style={{ fontSize: '1.2rem', textAlign: 'center', fontWeight: 700 }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Comida</label>
            <select name="mealType" className="form-select" defaultValue={defaultMeal}>
              {MEALS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Añadiendo…' : 'Añadir al diario'}
          </button>
        </form>
      )}
    </div>
  )
}
