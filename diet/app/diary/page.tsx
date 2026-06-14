import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { getDayEntries, deleteDiaryEntry } from '@/lib/actions/diary'
import { computeMacros } from '@/lib/diary-utils'
import { getUserWithGoals } from '@/lib/auth'
import BottomNav from '@/components/BottomNav'

const MEAL_LABELS: Record<string, string> = {
  breakfast: '🌅 Desayuno',
  lunch: '🥗 Comida',
  dinner: '🌙 Cena',
  snack: '🍎 Snack',
}

function offsetDate(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export default async function DiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const session = await requireAuth()
  const params = await searchParams
  const date = params.date ?? new Date().toISOString().slice(0, 10)
  const entries = await getDayEntries(session.id, date)
  const macros = computeMacros(entries)
  const user = await getUserWithGoals(session.id)
  const goals = user?.goals ?? { kcal: 2000, proteinG: 150, carbsG: 250, fatG: 67, fiberG: 30 }

  const byMeal = entries.reduce<Record<string, typeof entries>>((acc, e) => {
    ;(acc[e.mealType] ||= []).push(e)
    return acc
  }, {})

  const prevDate = new Date(date)
  prevDate.setDate(prevDate.getDate() - 1)
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + 1)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      <div className="page">
        {/* Date nav */}
        <div className="top-bar">
          <h1>Diario</h1>
          <Link href="/diary/add" className="btn-icon" style={{ textDecoration: 'none' }}>＋</Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Link href={`/diary?date=${prevDate.toISOString().slice(0, 10)}`} className="btn btn-ghost" style={{ width: 44, height: 44, minHeight: 44, padding: 0 }}>‹</Link>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
            {date === today ? 'Hoy' : fmtDate(date)}
          </span>
          <Link href={`/diary?date=${nextDate.toISOString().slice(0, 10)}`} className="btn btn-ghost" style={{ width: 44, height: 44, minHeight: 44, padding: 0, opacity: date >= today ? 0.3 : 1, pointerEvents: date >= today ? 'none' : 'auto' }}>›</Link>
        </div>

        {/* Summary */}
        <div className="stat-chips">
          <div className="stat-chip">
            <div className="stat-chip-val">{Math.round(macros.kcal)}</div>
            <div className="stat-chip-label">kcal</div>
          </div>
          <div className="stat-chip">
            <div className="stat-chip-val">{Math.round(macros.protein)}g</div>
            <div className="stat-chip-label">prot</div>
          </div>
          <div className="stat-chip">
            <div className="stat-chip-val">{Math.round(macros.carbs)}g</div>
            <div className="stat-chip-label">HC</div>
          </div>
          <div className="stat-chip">
            <div className="stat-chip-val">{Math.round(macros.fat)}g</div>
            <div className="stat-chip-label">grasa</div>
          </div>
        </div>

        {/* Meals */}
        {Object.entries(MEAL_LABELS).map(([type, label]) => {
          const mealEntries = byMeal[type] ?? []
          const mealKcal = mealEntries.reduce((s, e) => s + (e.food.kcalPer100g * e.quantityG) / 100, 0)
          return (
            <div key={type} className="card">
              <div className="meal-header">
                <div className="meal-title">{label}</div>
                {mealKcal > 0 && <div className="meal-kcal">{Math.round(mealKcal)} kcal</div>}
              </div>
              {mealEntries.map((e) => (
                <div key={e.id} className="food-row">
                  <div style={{ flex: 1 }}>
                    <div className="food-name">{e.food.name}</div>
                    <div className="food-detail">
                      {e.quantityG}g · P:{Math.round(e.food.proteinG * e.quantityG / 100)}g HC:{Math.round(e.food.carbsG * e.quantityG / 100)}g G:{Math.round(e.food.fatG * e.quantityG / 100)}g
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="food-kcal">{Math.round((e.food.kcalPer100g * e.quantityG) / 100)} kcal</div>
                    <form action={async () => { 'use server'; await deleteDiaryEntry(e.id) }}>
                      <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.2rem', lineHeight: 1, padding: '4px', borderRadius: '6px' }} title="Eliminar">×</button>
                    </form>
                  </div>
                </div>
              ))}
              <Link href={`/diary/add?date=${date}&meal=${type}`} style={{ display: 'block', marginTop: mealEntries.length ? 8 : 0 }}>
                <button className="btn btn-ghost" style={{ width: '100%', fontSize: '0.85rem', minHeight: 40, padding: '8px' }}>
                  + Añadir a {label.split(' ')[1] ?? label}
                </button>
              </Link>
            </div>
          )
        })}
      </div>
      <BottomNav active="/diary" />
    </>
  )
}
