'use client'

import { useState, useCallback, Suspense } from 'react'
import { useFormState } from 'react-dom'
import SubmitButton from '@/components/SubmitButton'
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

type Source = 'local' | 'usda'
type FoodItem = FoodResult & { source?: Source }

type SafetyData = {
  recalls: { number: string; reason: string; classification: string; status: string; date: string; firm: string }[]
  events: { reactions: string[]; outcomes: unknown }[]
} | null

export default function AddDiaryEntryPage() {
  return (
    <Suspense fallback={<div className="page-no-nav" style={{ padding: 24 }}>Cargando…</div>}>
      <AddDiaryEntryInner />
    </Suspense>
  )
}

function AddDiaryEntryInner() {
  const params = useSearchParams()
  const router = useRouter()
  const [state, action] = useFormState(addDiaryEntry, null)
  const [q, setQ] = useState('')
  const [localResults, setLocalResults] = useState<FoodItem[]>([])
  const [usdaResults, setUsdaResults] = useState<FoodItem[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<FoodItem | null>(null)
  const [qty, setQty] = useState('')
  const [safety, setSafety] = useState<SafetyData>(null)
  const [loadingSafety, setLoadingSafety] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const date = params.get('date') ?? today
  const defaultMeal = (params.get('meal') as string) ?? 'breakfast'

  const search = useCallback(async (val: string) => {
    setQ(val)
    setLocalResults([])
    setUsdaResults([])
    if (val.length < 2) return

    setSearching(true)
    // Parallel: local DB + USDA
    const [localRes, usdaRes] = await Promise.all([
      fetch(`/api/foods?q=${encodeURIComponent(val)}`).then(r => r.json()).catch(() => []),
      fetch(`/api/fda-search?q=${encodeURIComponent(val)}`).then(r => r.json()).catch(() => []),
    ])
    setLocalResults((localRes as FoodItem[]).map((f: FoodItem) => ({ ...f, source: 'local' as Source })))
    setUsdaResults((usdaRes as FoodItem[]).map((f: FoodItem) => ({ ...f, source: 'usda' as Source })))
    setSearching(false)
  }, [])

  const checkSafety = useCallback(async (name: string) => {
    setLoadingSafety(true)
    const res = await fetch(`/api/fda-safety?q=${encodeURIComponent(name)}`).then(r => r.json()).catch(() => ({ recalls: [], events: [] }))
    setSafety(res)
    setLoadingSafety(false)
  }, [])

  const allResults = [...localResults, ...usdaResults.filter(u => !localResults.some(l => l.name.toLowerCase() === u.name.toLowerCase()))]

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
              placeholder="Buscar alimento… (local + FDA/USDA)"
              value={q}
              onChange={(e) => search(e.target.value)}
              autoFocus
            />
          </div>

          {searching && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
              Buscando en base de datos FDA…
            </div>
          )}

          {allResults.length > 0 && (
            <div>
              {allResults.map((food) => (
                <button
                  key={food.id}
                  className="food-card"
                  style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => { setSelected(food); setQty(String(food.servingG)); setSafety(null) }}
                >
                  <div>
                    <div className="food-card-name">
                      {food.name}
                      {food.source === 'usda' && (
                        <span style={{ marginLeft: 6, fontSize: '0.65rem', background: '#dbeafe', color: '#1d4ed8', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>FDA</span>
                      )}
                      {food.verified && <span className="badge" style={{ marginLeft: 4 }}>✓</span>}
                    </div>
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

          {!searching && q.length >= 2 && allResults.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🔍</div>
              <div>No encontrado en ninguna base de datos</div>
              <Link href="/foods/add" style={{ color: 'var(--green-dark)', fontWeight: 600, fontSize: '0.9rem', display: 'block', marginTop: 8 }}>
                + Crear alimento personalizado
              </Link>
            </div>
          )}

          {q.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>🥦</div>
              <div style={{ fontSize: '0.9rem' }}>Busca en nuestra base de datos y en FDA/USDA</div>
              <Link href="/foods/add" style={{ color: 'var(--green-dark)', fontWeight: 600, fontSize: '0.9rem', display: 'block', marginTop: 12 }}>
                + Añadir alimento nuevo
              </Link>
            </div>
          )}
        </>
      ) : (
        <div>
          <form action={action}>
            <input type="hidden" name="foodId" value={selected.id.startsWith('usda_') ? selected.id.replace('usda_', '') : selected.id} />
            <input type="hidden" name="date" value={date} />

            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selected.name}</div>
                  {selected.brand && <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{selected.brand}</div>}
                  {selected.source === 'usda' && (
                    <span style={{ fontSize: '0.7rem', background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4, fontWeight: 700, display: 'inline-block', marginTop: 4 }}>
                      Base de datos FDA/USDA
                    </span>
                  )}
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
                type="number" name="quantityG" className="form-input"
                value={qty} onChange={(e) => setQty(e.target.value)}
                min="1" step="1" required
                style={{ fontSize: '1.2rem', textAlign: 'center', fontWeight: 700 }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Comida</label>
              <select name="mealType" className="form-select" defaultValue={defaultMeal}>
                {MEALS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            <SubmitButton pendingText="Añadiendo…" className="btn btn-primary">Añadir al diario</SubmitButton>
          </form>

          {/* FDA Safety Check */}
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => checkSafety(selected.name)}
              className="btn btn-ghost"
              style={{ width: '100%', fontSize: '0.85rem' }}
              disabled={loadingSafety}
            >
              {loadingSafety ? 'Consultando FDA…' : '🛡️ Verificar alertas de seguridad FDA'}
            </button>

            {safety && (
              <div style={{ marginTop: 10 }}>
                {safety.recalls.length === 0 && safety.events.length === 0 ? (
                  <div className="alert alert-success">✓ Sin alertas de retirada o eventos adversos en la FDA</div>
                ) : (
                  <div>
                    {safety.recalls.length > 0 && (
                      <div className="alert alert-error">
                        <strong>⚠️ {safety.recalls.length} alerta(s) de retirada FDA</strong>
                        {safety.recalls.map((r, i) => (
                          <div key={i} style={{ marginTop: 6, fontSize: '0.8rem' }}>
                            <strong>{r.classification}</strong> · {r.firm} · {r.date?.slice(0, 10)}<br />
                            {r.reason}
                          </div>
                        ))}
                      </div>
                    )}
                    {safety.events.length > 0 && (
                      <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 10, padding: '10px 14px', fontSize: '0.8rem', marginTop: 6 }}>
                        <strong>ℹ️ {safety.events.length} evento(s) adverso(s)</strong>
                        {safety.events[0]?.reactions && (
                          <div style={{ marginTop: 4 }}>Reacciones: {safety.events[0].reactions.join(', ')}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
