import Link from 'next/link'
import { requireAuth, getUserWithGoals, todayStr } from '@/lib/auth'
import { getDayEntries, computeMacros } from '@/lib/actions/diary'
import BottomNav from '@/components/BottomNav'
import MacroBars from '@/components/MacroBars'

const MEAL_LABELS: Record<string, string> = {
  breakfast: '🌅 Desayuno',
  lunch: '🥗 Comida',
  dinner: '🌙 Cena',
  snack: '🍎 Snack',
}

export default async function DashboardPage() {
  const session = await requireAuth()
  const user = await getUserWithGoals(session.id)
  const today = todayStr()
  const entries = await getDayEntries(session.id, today)
  const macros = computeMacros(entries)
  const goals = user?.goals ?? { kcal: 2000, proteinG: 150, carbsG: 250, fatG: 67, fiberG: 30 }

  const remaining = goals.kcal - macros.kcal
  const pct = Math.min(100, (macros.kcal / goals.kcal) * 100)
  const over = macros.kcal > goals.kcal

  const r = 60
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ

  const byMeal = entries.reduce<Record<string, typeof entries>>((acc, e) => {
    ;(acc[e.mealType] ||= []).push(e)
    return acc
  }, {})

  const dateLabel = new Date(today + 'T12:00:00').toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <>
      <div className="page">
        {/* Daddy's Trainer brand header */}
        <div className="brand-header">
          <div className="brand-logo">🏋️</div>
          <div>
            <div className="brand-name"><span>DADDY&apos;S</span> TRAINER</div>
            <div className="brand-sub">Coach Pietro · Nutrición & Culturismo</div>
          </div>
        </div>

        <div className="top-bar">
          <div>
            <h1>Hola, {session.name.split(' ')[0]} 👋</h1>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'capitalize' }}>{dateLabel}</div>
          </div>
          <Link href="/diary/add" className="btn-icon" style={{ textDecoration: 'none' }}>＋</Link>
        </div>

        {/* Quick access */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { href: '/clients', emoji: '👥', label: 'Clientes' },
            { href: '/assessment/new', emoji: '📐', label: 'Valorar' },
            { href: '/supplements', emoji: '💊', label: 'Suplementos' },
            { href: '/juices', emoji: '🥤', label: 'Zumos' },
          ].map((a) => (
            <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '10px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem' }}>{a.emoji}</div>
                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>{a.label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Calorie ring */}
        <div className="card">
          <div className="card-title">Calorías hoy</div>
          <div className="calorie-ring-wrap">
            <div className="calorie-ring">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle className="ring-track" cx="70" cy="70" r={r} />
                <circle
                  className={`ring-progress${over ? ' ring-over' : ''}`}
                  cx="70" cy="70" r={r}
                  strokeDasharray={circ}
                  strokeDashoffset={offset}
                />
              </svg>
              <div className="ring-center">
                <span className="ring-kcal">{Math.round(macros.kcal)}</span>
                <span className="ring-label">de {goals.kcal} kcal</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: over ? 'var(--red)' : 'var(--green-dark)' }}>
                  {over ? '+' : ''}{Math.round(Math.abs(remaining))}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{over ? 'exceso' : 'restantes'}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700 }}>{entries.length}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>entradas</div>
              </div>
            </div>
          </div>
          <MacroBars macros={{ protein: macros.protein, carbs: macros.carbs, fat: macros.fat, fiber: macros.fiber }} goals={{ proteinG: goals.proteinG, carbsG: goals.carbsG, fatG: goals.fatG, fiberG: goals.fiberG }} />
        </div>

        {/* Meals */}
        {entries.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🍽️</div>
            <div style={{ fontWeight: 600 }}>No has registrado nada hoy</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '8px 0 16px' }}>
              Empieza añadiendo tu primer alimento
            </div>
            <Link href="/diary/add" className="btn btn-primary" style={{ display: 'inline-flex', width: 'auto' }}>
              Añadir alimento
            </Link>
          </div>
        ) : (
          Object.entries(MEAL_LABELS).map(([type, label]) => {
            const mealEntries = byMeal[type]
            if (!mealEntries?.length) return null
            const mealKcal = mealEntries.reduce((s, e) => s + (e.food.kcalPer100g * e.quantityG) / 100, 0)
            return (
              <div key={type} className="card">
                <div className="meal-header">
                  <div className="meal-title">{label}</div>
                  <div className="meal-kcal">{Math.round(mealKcal)} kcal</div>
                </div>
                {mealEntries.map((e) => (
                  <div key={e.id} className="food-row">
                    <div>
                      <div className="food-name">{e.food.name}</div>
                      <div className="food-detail">{e.quantityG}g</div>
                    </div>
                    <div className="food-kcal">{Math.round((e.food.kcalPer100g * e.quantityG) / 100)} kcal</div>
                  </div>
                ))}
              </div>
            )
          })
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Link href="/diary/add" style={{ flex: 1 }}>
            <button className="btn btn-ghost" style={{ width: '100%' }}>+ Añadir alimento</button>
          </Link>
          <Link href="/foods" style={{ flex: 1 }}>
            <button className="btn btn-ghost" style={{ width: '100%' }}>🔍 Buscar</button>
          </Link>
        </div>
      </div>
      <BottomNav active="/dashboard" />
    </>
  )
}
