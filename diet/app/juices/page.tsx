import BottomNav from '@/components/BottomNav'
import { JUICES } from '@/lib/nutrition'

export default function JuicesPage() {
  return (
    <>
      <div className="page">
        <div className="top-bar">
          <h1>🥤 Zumos vitamínicos</h1>
        </div>

        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 16, lineHeight: 1.6 }}>
          Zumos naturales optimizados para culturismo y rendimiento. Sin azúcares añadidos. Frutas y verduras frescas.
        </p>

        {JUICES.map((j) => (
          <div key={j.name} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ fontSize: '1.8rem' }}>{j.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{j.name}</div>
                <div style={{ fontSize: '0.75rem', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ background: 'var(--green-light)', color: 'var(--green-dark)', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>
                    🎯 {j.objective}
                  </span>
                  <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>
                    ~{j.kcal} kcal
                  </span>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div className="card-title" style={{ marginBottom: 6 }}>Ingredientes</div>
              {j.ingredients.map((ing) => (
                <div key={ing} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--green)' }}>→</span>
                  <span>{ing}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <strong>Beneficios:</strong> {j.benefits}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--blue)', marginTop: 4, fontWeight: 600 }}>
              ⏰ {j.timing}
            </div>
          </div>
        ))}

        <div style={{ background: 'var(--green-light)', borderRadius: 12, padding: '14px 16px', fontSize: '0.82rem', lineHeight: 1.6 }}>
          <strong>💡 Consejos:</strong> Preparar en el momento (oxidación rápida de vitaminas). Usar licuadora centrífuga o prensa fría.
          No filtrar el bagazo si se puede — la fibra es parte del beneficio. Consumir en los 15 min siguientes.
        </div>
      </div>
      <BottomNav active="/juices" />
    </>
  )
}
