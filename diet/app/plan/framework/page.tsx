import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { getUserPlan } from '@/lib/actions/plan'

const FRAMEWORKS = [
  {
    meal: 'breakfast',
    label: '🌅 Desayuno',
    template: 'proteína + fibra + fruta',
    examples: [
      'Avena con leche + fruta + nueces',
      'Huevos revueltos + pan integral + naranja',
      'Yogur griego + frutos rojos + granola',
    ],
    tip: 'Incluir proteína en el desayuno reduce el hambre a media mañana.',
  },
  {
    meal: 'lunch',
    label: '🥗 Comida',
    template: 'proteína + verduras + carbohidrato',
    examples: [
      'Pollo a la plancha + ensalada + arroz',
      'Lentejas con verduras',
      'Salmón + brócoli + patata',
    ],
    tip: 'La comida principal: fija la mayor parte de proteína y verdura del día.',
  },
  {
    meal: 'dinner',
    label: '🌙 Cena',
    template: 'proteína + verduras + grasa saludable',
    examples: [
      'Pechuga de pavo + ensalada + aguacate',
      'Huevos + verduras salteadas',
      'Atún + tomate + aceite de oliva',
    ],
    tip: 'Reducir carbos en cena puede ayudar en pérdida de peso sin pasar hambre.',
  },
  {
    meal: 'snack',
    label: '🍎 Snack (si necesitas)',
    template: 'proteína + fruta O verdura + grasa',
    examples: [
      'Queso fresco + manzana',
      'Almendras (30g) + fruta',
      'Yogur griego natural',
    ],
    tip: 'Los snacks son opcionales. Solo si hay más de 5h entre comidas.',
  },
]

export default async function FrameworkPage() {
  const session = await requireAuth()
  const plan = await getUserPlan(session.id)

  return (
    <div className="page-no-nav" style={{ paddingTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Link href="/plan" className="btn btn-ghost" style={{ width: 40, height: 40, minHeight: 40, padding: 0, fontSize: '1.2rem' }}>‹</Link>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Paso 3 de 6</div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>🍽️ Marco de comidas</h1>
        </div>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 16, lineHeight: 1.6 }}>
        Plantillas, no planes rígidos. Los marcos sobreviven; los planes de dieta se abandonan al 4.º día.
      </p>

      <div style={{ background: 'var(--green-light)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: '0.85rem' }}>
        <strong>Reglas base:</strong>
        <ul style={{ marginTop: 6, paddingLeft: 16, lineHeight: 1.8 }}>
          <li>Proteína en cada comida</li>
          <li>Verdura en al menos 2 comidas</li>
          <li>Construye desde comidas que ya te gustan</li>
          {plan?.kcalMin && <li>Rango: <strong>{plan.kcalMin}–{plan.kcalMax} kcal/día</strong></li>}
        </ul>
      </div>

      {FRAMEWORKS.map((fw) => (
        <div key={fw.meal} className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>{fw.label}</div>
          <div style={{ display: 'inline-block', background: 'var(--green-light)', color: 'var(--green-dark)', padding: '2px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, marginBottom: 10 }}>
            {fw.template}
          </div>
          <div className="card-title" style={{ marginBottom: 6 }}>Ejemplos</div>
          {fw.examples.map((ex) => (
            <div key={ex} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--green)', fontWeight: 700, flexShrink: 0 }}>→</span>
              <span style={{ fontSize: '0.88rem' }}>{ex}</span>
            </div>
          ))}
          <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.5, fontStyle: 'italic' }}>
            💡 {fw.tip}
          </div>
        </div>
      ))}

      <div style={{ background: '#fef3c7', border: '1.5px solid #fbbf24', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: '0.82rem', lineHeight: 1.6 }}>
        <strong>¿Cómo usar esto?</strong> No tienes que seguir estos ejemplos al pie de la letra. Úsalos como estructura.
        Si ya comes arroz con pollo, perfecto — añade brócoli y ya cumples el marco de la comida.
      </div>

      <Link href="/plan/obstacles" className="btn btn-primary" style={{ display: 'flex' }}>
        Siguiente: Plan para obstáculos →
      </Link>
      <Link href="/plan" style={{ display: 'block', textAlign: 'center', marginTop: 12, color: 'var(--muted)', fontSize: '0.85rem' }}>
        Volver al resumen
      </Link>
    </div>
  )
}
