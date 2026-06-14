import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { getClients } from '@/lib/actions/clients'
import { bfCategory } from '@/lib/nutrition'
import type { Sex } from '@/lib/nutrition'
import BottomNav from '@/components/BottomNav'

const CATEGORY_BADGE: Record<string, { label: string; color: string }> = {
  beginner: { label: 'Principiante', color: '#64748b' },
  recreational: { label: 'Recreativo', color: '#2563eb' },
  natural_comp: { label: 'Competición Natural', color: '#16a34a' },
  enhanced_comp: { label: '⚡ Enhanced', color: '#7c3aed' },
  trt: { label: 'TRT', color: '#d97706' },
}

export default async function ClientsPage() {
  await requireAuth()
  const clients = await getClients()

  return (
    <>
      <div className="page">
        <div className="top-bar">
          <h1>Clientes</h1>
          <Link href="/clients/new" className="btn-icon" style={{ textDecoration: 'none' }}>＋</Link>
        </div>

        {clients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>👤</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Sin clientes aún</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 20 }}>
              Crea la primera ficha de cliente
            </div>
            <Link href="/clients/new" className="btn btn-primary" style={{ display: 'inline-flex', width: 'auto' }}>
              Nuevo cliente
            </Link>
          </div>
        ) : (
          clients.map((c) => {
            const last = c.assessments[0]
            const cat = CATEGORY_BADGE[c.category]
            const bf = last?.bodyFatPct
            const bfCat = bf ? bfCategory(bf, (c.sex ?? 'M') as Sex) : null
            const age = c.birthDate ? new Date().getFullYear() - new Date(c.birthDate).getFullYear() : null
            return (
              <Link key={c.id} href={`/clients/${c.id}`} style={{ display: 'block', textDecoration: 'none', marginBottom: 10 }}>
                <div className="card" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{
                      width: 48, height: 48,
                      borderRadius: '50%',
                      background: c.sex === 'F' ? '#fce7f3' : '#dbeafe',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.4rem', flexShrink: 0,
                    }}>
                      {c.sex === 'F' ? '👩' : '👨'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{c.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 4 }}>
                        {age && `${age} años · `}{c.weightKg && `${c.weightKg} kg · `}{c.heightCm && `${c.heightCm} cm`}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ background: `${cat?.color}22`, color: cat?.color, padding: '2px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600 }}>
                          {cat?.label}
                        </span>
                        {bf != null && bfCat && (
                          <span style={{ background: `${bfCat.color}22`, color: bfCat.color, padding: '2px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600 }}>
                            {bf}% grasa
                          </span>
                        )}
                        {c.isEnhanced && (
                          <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600 }}>
                            ⚠️ Ciclo activo
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: '1.2rem' }}>›</div>
                  </div>
                  {last?.tdee && (
                    <div style={{ marginTop: 8, padding: '6px 10px', background: 'var(--bg)', borderRadius: 8, fontSize: '0.75rem', display: 'flex', gap: 12 }}>
                      <span>🔥 TDEE: <strong>{last.tdee} kcal</strong></span>
                      <span>🎯 Objetivo: <strong>{last.targetKcal} kcal</strong></span>
                      {last.leanMassKg && <span>💪 Magra: <strong>{last.leanMassKg} kg</strong></span>}
                    </div>
                  )}
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
