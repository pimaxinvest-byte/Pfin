import Link from 'next/link'
import { getSupplements, CATEGORY_LABELS } from '@/lib/nutrition'
import type { BuildingCategory } from '@/lib/nutrition'
import BottomNav from '@/components/BottomNav'

const CATEGORIES: { key: BuildingCategory; emoji: string }[] = [
  { key: 'beginner', emoji: '🟢' },
  { key: 'recreational', emoji: '🔵' },
  { key: 'natural_comp', emoji: '🏆' },
  { key: 'enhanced_comp', emoji: '⚡' },
  { key: 'trt', emoji: '💉' },
]

const GOALS = [
  { key: 'lose', label: 'Pérdida de grasa' },
  { key: 'gain', label: 'Ganancia muscular' },
  { key: 'maintain', label: 'Mantenimiento / Rendimiento' },
]

const PRIORITY_COLOR: Record<string, string> = {
  esencial: '#16a34a',
  recomendado: '#2563eb',
  opcional: '#64748b',
}

export default function SupplementsPage() {
  return (
    <>
      <div className="page">
        <div className="top-bar">
          <h1>💊 Suplementos</h1>
        </div>

        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 16, lineHeight: 1.6 }}>
          Protocolo de suplementación por objetivo y categoría. Los suplementos enhanced incluyen protectores hepáticos y cardiovasculares obligatorios.
        </p>

        {GOALS.map((g) => (
          <div key={g.key} style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 12, padding: '8px 14px', background: 'var(--green-light)', borderRadius: 10, color: 'var(--green-dark)' }}>
              🎯 {g.label}
            </div>

            {CATEGORIES.map((cat) => {
              const supps = getSupplements(g.key, cat.key)
              return (
                <div key={cat.key} className="card" style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 10 }}>
                    {cat.emoji} {CATEGORY_LABELS[cat.key]}
                  </div>
                  {['esencial', 'recomendado', 'opcional'].map((priority) => {
                    const list = supps.filter(s => s.priority === priority)
                    if (!list.length) return null
                    return (
                      <div key={priority} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: PRIORITY_COLOR[priority], textTransform: 'uppercase', marginBottom: 4 }}>
                          {priority}
                        </div>
                        {list.map((s) => (
                          <div key={s.name} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                            <div style={{ fontWeight: 600 }}>{s.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                              {s.dose} · {s.timing}
                              {s.note && <><br /><em style={{ color: '#92400e' }}>⚠️ {s.note}</em></>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}

        <div style={{ background: '#fef3c7', borderRadius: 12, padding: '14px 16px', fontSize: '0.8rem', lineHeight: 1.6, marginBottom: 20 }}>
          <strong>⚠️ Aviso médico:</strong> Los suplementos para categoría Enhanced y TRT no sustituyen supervisión médica.
          Exigir analítica (hepatograma, hemograma completo, lipidograma, hormonas) antes y durante cualquier ciclo.
          El entrenador no es médico ni prescribe fármacos.
        </div>
      </div>
      <BottomNav active="/supplements" />
    </>
  )
}
