import Link from 'next/link'
import { requireAuth, getUserWithGoals } from '@/lib/auth'
import { getUserPlan } from '@/lib/actions/plan'
import BottomNav from '@/components/BottomNav'

const STEPS = [
  { href: '/plan/setup', emoji: '📋', title: 'Patrones actuales', desc: 'Cómo comes hoy de verdad' },
  { href: '/plan/goals', emoji: '🎯', title: 'Objetivo y enfoque', desc: 'Qué quieres lograr y en cuánto tiempo' },
  { href: '/plan/framework', emoji: '🍽️', title: 'Marco de comidas', desc: 'Plantillas por comida (no planes rígidos)' },
  { href: '/plan/obstacles', emoji: '🛡️', title: 'Plan para obstáculos', desc: 'Restaurantes, viajes, bajones de fuerza' },
  { href: '/plan/shopping', emoji: '🛒', title: 'Compra semanal', desc: 'Lista base y día de preparación' },
  { href: '/plan/habits', emoji: '📈', title: 'Hábitos graduales', desc: 'Un cambio por semana, no una dieta nueva' },
]

function completionOf(plan: Awaited<ReturnType<typeof getUserPlan>>) {
  if (!plan) return Array(6).fill(false)
  return [
    !!plan.mealsPerDay || !!plan.cookingFreq,
    !!plan.primaryGoal,
    true,
    !!plan.restaurantStrategy,
    !!plan.shoppingDay,
    !!plan.week1Habit,
  ]
}

export default async function PlanPage() {
  const session = await requireAuth()
  const plan = await getUserPlan()
  const user = await getUserWithGoals(session.id)
  const goals = user?.goals
  const done = completionOf(plan)
  const completedCount = done.filter(Boolean).length

  return (
    <>
      <div className="page">
        <div className="top-bar">
          <h1>Mi Plan</h1>
          {plan && (
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{completedCount}/6 pasos</div>
          )}
        </div>

        {!plan && (
          <div className="card" style={{ textAlign: 'center', padding: '24px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🥗</div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 6 }}>Plan nutricional personalizado</div>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 16, lineHeight: 1.6 }}>
              Un plan que parte de cómo comes ahora, no de una dieta ideal.<br />
              Empieza por el paso 1 y completa los que puedas.
            </p>
            <Link href="/plan/setup" className="btn btn-primary" style={{ display: 'inline-flex', width: 'auto' }}>
              Empezar ahora
            </Link>
          </div>
        )}

        {plan?.kcalMin && plan?.kcalMax && (
          <div className="card" style={{ background: 'var(--green-light)', borderColor: 'var(--green)', border: '1.5px solid', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>🎯 Tu rango calórico</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--green-dark)' }}>
              {plan.kcalMin}–{plan.kcalMax} kcal/día
            </div>
            {plan.approach && (
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>
                Enfoque: {plan.approach === 'calorie_counting' ? 'Conteo de calorías' : plan.approach === 'portion' ? 'Porciones' : plan.approach === 'quality' ? 'Calidad alimentaria' : 'Hábitos graduales'}
              </div>
            )}
          </div>
        )}

        {/* Week implementation tracker */}
        {plan?.week1Habit && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Semana actual · Semana {(plan.currentWeek ?? 0) + 1}</div>
            {[plan.week1Habit, plan.week2Habit, plan.week3Habit, plan.week4Habit].map((habit, i) => {
              if (!habit) return null
              const active = i === (plan.currentWeek ?? 0)
              const past = i < (plan.currentWeek ?? 0)
              return (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none', opacity: active || past ? 1 : 0.4 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: past ? 'var(--green)' : active ? 'var(--green-light)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: past ? '#fff' : 'var(--green-dark)', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
                    {past ? '✓' : i + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Semana {i + 1}</div>
                    <div style={{ fontWeight: active ? 700 : 400, fontSize: '0.9rem' }}>{habit}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Steps */}
        {STEPS.map((step, i) => (
          <Link key={step.href} href={step.href} style={{ textDecoration: 'none', display: 'block', marginBottom: 8 }}>
            <div className="card" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>{step.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{i + 1}. {step.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{step.desc}</div>
              </div>
              <div style={{ color: done[i] ? 'var(--green)' : 'var(--border)', fontSize: '1.1rem', flexShrink: 0 }}>
                {done[i] ? '✓' : '›'}
              </div>
            </div>
          </Link>
        ))}

        <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--surface)', borderRadius: 10, border: '1.5px dashed var(--border)', fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.6 }}>
          💡 <strong>Regla de oro:</strong> Una comida fuera del plan por semana es parte del sistema, no un fracaso.
        </div>
      </div>
      <BottomNav active="/plan" />
    </>
  )
}
