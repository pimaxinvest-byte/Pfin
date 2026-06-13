'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import type { FoodResult } from '@/lib/actions/foods'

export default function FoodsPage() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<FoodResult[]>([])

  const search = useCallback(async (val: string) => {
    setQ(val)
    if (val.length < 2) { setResults([]); return }
    const res = await fetch(`/api/foods?q=${encodeURIComponent(val)}`)
    const data = await res.json()
    setResults(data)
  }, [])

  return (
    <>
      <div className="page">
        <div className="top-bar">
          <h1>Alimentos</h1>
          <Link href="/foods/add" className="btn-icon" style={{ textDecoration: 'none' }}>＋</Link>
        </div>

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
          />
        </div>

        {results.length > 0 ? (
          results.map((food) => (
            <Link key={food.id} href={`/diary/add?food=${food.id}`} style={{ display: 'block', textDecoration: 'none' }}>
              <div className="food-card">
                <div>
                  <div className="food-card-name">
                    {food.name}
                    {food.verified && <span className="badge" style={{ marginLeft: 6 }}>✓</span>}
                  </div>
                  <div className="food-card-meta">
                    {food.brand && `${food.brand} · `}
                    P:{food.proteinG}g · HC:{food.carbsG}g · G:{food.fatG}g por 100g
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="food-card-kcal">{food.kcalPer100g}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>kcal/100g</div>
                </div>
              </div>
            </Link>
          ))
        ) : q.length >= 2 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🔍</div>
            <div>Sin resultados para &quot;{q}&quot;</div>
            <Link href="/foods/add" style={{ color: 'var(--green-dark)', fontWeight: 600, fontSize: '0.9rem', display: 'block', marginTop: 10 }}>
              + Crear &quot;{q}&quot;
            </Link>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🥦🍗🥑</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Base de datos de alimentos</div>
            <div style={{ fontSize: '0.85rem' }}>Busca alimentos para ver su información nutricional</div>
          </div>
        )}
      </div>
      <BottomNav active="/foods" />
    </>
  )
}
