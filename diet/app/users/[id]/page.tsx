import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireTrainer, roleForEmail } from '@/lib/auth'
import { getUserDetail } from '@/lib/actions/users'
import { generateVariedWeekPlan } from '@/lib/recipes'
import BottomNav from '@/components/BottomNav'

const GOAL_ES: Record<string, string> = { lose: 'Definición', maintain: 'Mantenimiento', gain: 'Volumen' }
const ACT_ES: Record<string, string> = { sedentary: 'Sedentario', light: 'Ligero', moderate: 'Moderado', active: 'Activo', very_active: 'Muy activo' }

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
      <span style={{ color: 'var(--muted)', minWidth: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  )
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireTrainer()
  const user = await getUserDetail(id)
  if (!user) notFound()

  const p = user.profile
  const g = user.goals
  const age = p?.birthYear ? new Date().getFullYear() - p.birthYear : null
  const goal = p?.goal ?? 'maintain'
  const weekPlan = g?.kcal ? generateVariedWeekPlan(g.kcal, goal, user.id) : null

  return (
    <>
      <div className="page">
        <div className="top-bar" style={{ gap: 8 }}>
          <Link href="/users" className="btn btn-ghost" style={{ width: 40, height: 40, minHeight: 40, padding: 0, fontSize: '1.2rem' }}>‹</Link>
          <h1 style={{ flex: 1 }}>{user.name}</h1>
          {roleForEmail(user.email) === 'TRAINER' && (
            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#000', background: 'var(--gold)', padding: '2px 8px', borderRadius: 6 }}>TRAINER</span>
          )}
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">Datos</div>
          <Row label="Email" value={user.email} />
          <Row label="Sexo" value={p?.sex === 'M' ? 'Hombre' : p?.sex === 'F' ? 'Mujer' : null} />
          <Row label="Edad" value={age ? `${age} años` : null} />
          <Row label="Peso" value={p?.weightKg ? `${p.weightKg} kg` : null} />
          <Row label="Altura" value={p?.heightCm ? `${p.heightCm} cm` : null} />
          <Row label="Actividad" value={p?.activityLevel ? ACT_ES[p.activityLevel] : null} />
          <Row label="Objetivo" value={p?.goal ? GOAL_ES[p.goal] : null} />
          <Row label="Alta" value={new Date(user.createdAt).toLocaleDateString('es-ES')} />
        </div>

        {g?.kcal && (
          <div className="card" style={{ marginBottom: 14, background: 'var(--gold-light)', border: '1.5px solid var(--gold)' }}>
            <div className="card-title">🎯 Objetivos calculados</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gold-dark)' }}>{g.kcal} kcal/día</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>Proteína: {g.proteinG}g</span>
              <span>Carbos: {g.carbsG}g</span>
              <span>Grasa: {g.fatG}g</span>
              <span>Fibra: {g.fiberG}g</span>
            </div>
          </div>
        )}

        {user.assessments.length > 0 && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title">📊 Valoraciones</div>
            {user.assessments.map((a) => (
              <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                <div style={{ fontWeight: 600 }}>{a.date} · {a.weightKg}kg</div>
                <div style={{ color: 'var(--muted)', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                  {a.bodyFatPct != null && <span>Grasa: {a.bodyFatPct}%</span>}
                  {a.leanMassKg != null && <span>Magra: {a.leanMassKg}kg</span>}
                  {a.tdee != null && <span>TDEE: {a.tdee}kcal</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {weekPlan && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title">🍽️ Plan semanal sugerido</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 10 }}>Generado para ~{g!.kcal} kcal/día · variado</div>
            {Object.entries(weekPlan).map(([day, meals]) => (
              <div key={day} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--gold-dark)', marginBottom: 4 }}>{day}</div>
                {([
                  { label: '🌅', key: 'breakfast' as const },
                  { label: '🥗', key: 'lunch' as const },
                  { label: '🌙', key: 'dinner' as const },
                  { label: '🍎', key: 'snack' as const },
                ]).map(({ label, key }) => (
                  <div key={key} style={{ fontSize: '0.78rem', display: 'flex', gap: 6, padding: '3px 0' }}>
                    <span>{label}</span>
                    <span style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600 }}>{meals[key].title}</span>
                      <span style={{ color: 'var(--gold-dark)', marginLeft: 6 }}>~{meals[key].kcal} kcal</span>
                      <span style={{ display: 'block', color: 'var(--muted)', fontSize: '0.72rem', marginTop: 1 }}>{meals[key].prep}</span>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav active="/clients" />
    </>
  )
}
