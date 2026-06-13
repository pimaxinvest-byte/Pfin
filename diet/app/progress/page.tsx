import { requireAuth, getUserWithGoals } from '@/lib/auth'
import { db } from '@/lib/db'
import { computeMacros } from '@/lib/actions/diary'
import BottomNav from '@/components/BottomNav'

const DAY_NAMES = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

export default async function ProgressPage() {
  const session = await requireAuth()
  const user = await getUserWithGoals(session.id)
  const goals = user?.goals ?? { kcal: 2000, proteinG: 150, carbsG: 250, fatG: 67, fiberG: 30 }

  // Last 7 days
  const days: { date: string; label: string; dayName: string }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    days.push({
      date: iso,
      label: d.getDate().toString(),
      dayName: DAY_NAMES[d.getDay()],
    })
  }

  const allEntries = await db.diaryEntry.findMany({
    where: { userId: session.id, date: { in: days.map((d) => d.date) } },
    include: { food: true },
  })

  const byDate = days.map((d) => {
    const entries = allEntries.filter((e) => e.date === d.date)
    const m = computeMacros(entries)
    return { ...d, macros: m, entries: entries.length }
  })

  const totalDays = byDate.filter((d) => d.entries > 0).length
  const avgKcal = totalDays > 0
    ? Math.round(byDate.reduce((s, d) => s + d.macros.kcal, 0) / Math.max(totalDays, 1))
    : 0
  const maxKcal = Math.max(...byDate.map((d) => d.macros.kcal), goals.kcal)

  return (
    <>
      <div className="page">
        <div className="top-bar">
          <h1>Progreso</h1>
        </div>

        {/* Summary */}
        <div className="card">
          <div className="card-title">Últimos 7 días</div>
          <div className="stat-chips" style={{ marginBottom: 0 }}>
            <div className="stat-chip">
              <div className="stat-chip-val">{totalDays}</div>
              <div className="stat-chip-label">días reg.</div>
            </div>
            <div className="stat-chip">
              <div className="stat-chip-val">{avgKcal}</div>
              <div className="stat-chip-label">kcal/día</div>
            </div>
            <div className="stat-chip">
              <div className="stat-chip-val">{goals.kcal}</div>
              <div className="stat-chip-label">objetivo</div>
            </div>
          </div>
        </div>

        {/* Bar chart */}
        <div className="card">
          <div className="card-title">Calorías por día</div>
          <div className="week-grid">
            {byDate.map((d) => {
              const h = Math.min(80, (d.macros.kcal / maxKcal) * 80)
              const over = d.macros.kcal > goals.kcal
              const today = d.date === new Date().toISOString().slice(0, 10)
              return (
                <div key={d.date} className="day-col">
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: today ? 700 : 400 }}>
                    {Math.round(d.macros.kcal) || '–'}
                  </div>
                  <div className="day-bar-track">
                    <div
                      className={`day-bar-fill${over ? ' over' : ''}`}
                      style={{ height: h > 0 ? `${h}px` : '0%' }}
                    />
                  </div>
                  <div className="day-label">{d.dayName}</div>
                  <div className="day-label" style={{ fontWeight: today ? 700 : 400 }}>{d.label}</div>
                </div>
              )
            })}
          </div>

          {/* Goal line legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: '0.75rem', color: 'var(--muted)' }}>
            <div style={{ width: 20, height: 2, background: 'var(--orange)', borderRadius: 1 }} />
            Objetivo: {goals.kcal} kcal
          </div>
        </div>

        {/* Weekly macros average */}
        {totalDays > 0 && (
          <div className="card">
            <div className="card-title">Promedio de macros</div>
            {[
              { label: 'Proteínas', val: Math.round(byDate.reduce((s, d) => s + d.macros.protein, 0) / totalDays), goal: goals.proteinG, unit: 'g', cls: 'fill-protein' },
              { label: 'Hidratos', val: Math.round(byDate.reduce((s, d) => s + d.macros.carbs, 0) / totalDays), goal: goals.carbsG, unit: 'g', cls: 'fill-carbs' },
              { label: 'Grasas', val: Math.round(byDate.reduce((s, d) => s + d.macros.fat, 0) / totalDays), goal: goals.fatG, unit: 'g', cls: 'fill-fat' },
              { label: 'Fibra', val: Math.round(byDate.reduce((s, d) => s + d.macros.fiber, 0) / totalDays), goal: goals.fiberG, unit: 'g', cls: 'fill-fiber' },
            ].map((m) => (
              <div key={m.label} style={{ marginBottom: 10 }}>
                <div className="macro-label">
                  <span>{m.label}</span>
                  <span>{m.val}/{Math.round(m.goal)}{m.unit}</span>
                </div>
                <div className="macro-bar">
                  <div
                    className={`macro-fill ${m.cls}`}
                    style={{ width: `${Math.min(100, (m.val / Math.max(m.goal, 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {totalDays === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📊</div>
            <div>Registra alimentos para ver tu progreso</div>
          </div>
        )}
      </div>
      <BottomNav active="/progress" />
    </>
  )
}
