import Link from 'next/link'
import { requireTrainer, roleForEmail } from '@/lib/auth'
import { getAllUsers } from '@/lib/actions/users'
import BottomNav from '@/components/BottomNav'

const GOAL_ES: Record<string, string> = { lose: 'Definición', maintain: 'Mantenimiento', gain: 'Volumen' }

export default async function UsersPage() {
  await requireTrainer()
  const users = await getAllUsers()

  return (
    <>
      <div className="page">
        <div className="top-bar">
          <h1>Cuentas activas</h1>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{users.length}</span>
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 12 }}>
          Usuarios registrados que han introducido sus datos. Toca para ver su ficha completa.
        </div>

        {users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>👥</div>
            <div style={{ color: 'var(--muted)' }}>Aún no hay cuentas registradas.</div>
          </div>
        ) : (
          users.map((u) => {
            const isTrainer = roleForEmail(u.email) === 'TRAINER'
            return (
              <Link key={u.id} href={`/users/${u.id}`} style={{ textDecoration: 'none', display: 'block', marginBottom: 8 }}>
                <div className="card" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--gold-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                    {isTrainer ? '🏋️' : '🧑'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {u.name}
                      {isTrainer && <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#000', background: 'var(--gold)', padding: '1px 6px', borderRadius: 6 }}>TRAINER</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {u.goals?.kcal && <span>{u.goals.kcal} kcal</span>}
                      {u.profile?.weightKg && <span>{u.profile.weightKg} kg</span>}
                      {u.profile?.goal && <span>{GOAL_ES[u.profile.goal] ?? u.profile.goal}</span>}
                      <span>{u._count.diaryEntries} comidas · {u._count.assessments} valoraciones</span>
                    </div>
                  </div>
                  <div style={{ color: 'var(--border)', fontSize: '1.1rem', flexShrink: 0 }}>›</div>
                </div>
              </Link>
            )
          })
        )}
      </div>
      <BottomNav active="/clients" />
    </>
  )
}
