import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { getAssessments, deleteAssessment } from '@/lib/actions/assessment'
import { bfCategory } from '@/lib/nutrition'
import type { Sex } from '@/lib/nutrition'
import BottomNav from '@/components/BottomNav'

function Ring({ pct, color }: { pct: number; color: string }) {
  const r = 30
  const c = 2 * Math.PI * r
  const offset = c - (Math.min(pct, 100) / 100) * c
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--border)" strokeWidth={7} />
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset} />
    </svg>
  )
}

export default async function AssessmentPage() {
  await requireAuth()
  const list = await getAssessments()

  return (
    <>
      <div className="page">
        <div className="top-bar">
          <h1>📐 Valoraciones</h1>
          <Link href="/assessment/new" className="btn-icon" style={{ textDecoration: 'none' }}>＋</Link>
        </div>

        {list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📏</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Sin valoraciones</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 20 }}>
              Registra peso, pliegues y perímetros para calcular<br />% grasa y tu TDEE personalizado
            </div>
            <Link href="/assessment/new" className="btn btn-primary" style={{ display: 'inline-flex', width: 'auto' }}>
              Primera valoración
            </Link>
          </div>
        ) : (
          list.map((a) => {
            const bf = a.bodyFatPct ?? a.bodyFatNavy
            const cat = bf != null ? bfCategory(bf, 'M' as Sex) : null
            return (
              <div key={a.id} className="card" style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {bf != null && (
                    <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                      <Ring pct={bf} color={cat?.color ?? 'var(--green)'} />
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>{bf.toFixed(1)}%</span>
                        <span style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>grasa</span>
                      </div>
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{a.date}</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.78rem' }}>
                      {a.weightKg && <span>⚖️ {a.weightKg} kg</span>}
                      {a.leanMassKg && <span style={{ color: 'var(--blue)' }}>💪 {a.leanMassKg} kg magra</span>}
                      {a.tdee && <span style={{ color: 'var(--green-dark)' }}>🔥 {a.tdee} kcal TDEE</span>}
                      {a.bmr && <span style={{ color: 'var(--muted)' }}>BMR {a.bmr}</span>}
                    </div>
                    {cat && (
                      <span className="badge" style={{ background: `${cat.color}22`, color: cat.color, marginTop: 4 }}>{cat.label}</span>
                    )}
                    {(a.tricepsMm || a.waistCm) && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 4 }}>
                        {a.tricepsMm && `T:${a.tricepsMm} S:${a.subscapMm} Ab:${a.abdomMm} Sp:${a.suprailMm} M:${a.thighMm} mm`}
                        {a.waistCm && ` | Cin:${a.waistCm}cm`}
                      </div>
                    )}
                  </div>
                  <form action={async () => { 'use server'; await deleteAssessment(a.id) }}>
                    <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px 8px' }}>×</button>
                  </form>
                </div>
              </div>
            )
          })
        )}
      </div>
      <BottomNav active="/assessment" />
    </>
  )
}
