'use client'

import { useFormState } from 'react-dom'
import SubmitButton from '@/components/SubmitButton'
import Link from 'next/link'
import { savePlanGoals } from '@/lib/actions/plan'

export default function PlanGoalsPage() {
  const [state, action] = useFormState(savePlanGoals, null)

  return (
    <div className="page-no-nav" style={{ paddingTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Link href="/plan" className="btn btn-ghost" style={{ width: 40, height: 40, minHeight: 40, padding: 0, fontSize: '1.2rem' }}>‹</Link>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Paso 2 de 6</div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>🎯 Objetivo y enfoque</h1>
        </div>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 20, lineHeight: 1.6 }}>
        Distingue entre objetivos de calidad alimentaria y objetivos de gestión calórica. Son estrategias diferentes.
      </p>

      {state?.error && <div className="alert alert-error">{state.error}</div>}
      {state?.success && (
        <div className="alert alert-success">
          Guardado ✓ <Link href="/plan/framework" style={{ color: 'var(--green-dark)', fontWeight: 700 }}>→ Siguiente paso</Link>
        </div>
      )}

      <form action={action}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Objetivos</div>

          <div className="form-group">
            <label className="form-label">Objetivo principal</label>
            <input
              type="text"
              name="primaryGoal"
              className="form-input"
              placeholder="Ej: Perder 8 kg, mejorar energía, apoyar entrenamiento"
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>
              Si es pérdida de peso, escribe &quot;perder X kg&quot; para calcular tu rango calórico
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Objetivo secundario (opcional)</label>
            <input
              type="text"
              name="secondaryGoal"
              className="form-input"
              placeholder="Ej: Reducir dependencia del azúcar, comer más verdura"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Plazo realista (semanas)</label>
            <select name="timelineWeeks" className="form-select">
              <option value="">Seleccionar…</option>
              <option value="4">4 semanas (1 mes)</option>
              <option value="8">8 semanas (2 meses)</option>
              <option value="12">12 semanas (3 meses)</option>
              <option value="24">24 semanas (6 meses)</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">¿Qué has intentado antes y por qué no funcionó?</label>
            <input
              type="text"
              name="previousAttempt"
              className="form-input"
              placeholder="Ej: Dieta estricta, la abandoné a las 2 semanas"
            />
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Enfoque — elige el más sencillo que funcione</div>

          {[
            { value: 'calorie_counting', emoji: '🔢', label: 'Conteo de calorías', desc: 'Registrar todo. Más preciso, más esfuerzo.' },
            { value: 'portion', emoji: '✋', label: 'Porciones por mano', desc: 'Palma = proteína, puño = carbos, pulgar = grasa. Sin contar.' },
            { value: 'quality', emoji: '🥦', label: 'Calidad alimentaria', desc: 'Mejorar elecciones sin contar. Ideal para empezar.' },
            { value: 'habit', emoji: '🔁', label: 'Un hábito a la vez', desc: 'Un cambio por semana. El más sostenible.' },
          ].map((opt) => (
            <label key={opt.value} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'center' }}>
              <input type="radio" name="approach" value={opt.value} defaultChecked={opt.value === 'calorie_counting'} style={{ width: 18, height: 18, accentColor: 'var(--green)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{opt.emoji} {opt.label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>

        <SubmitButton pendingText="Calculando…" className="btn btn-primary">Guardar y calcular rango calórico</SubmitButton>
        <Link href="/plan/framework" style={{ display: 'block', textAlign: 'center', marginTop: 12, color: 'var(--muted)', fontSize: '0.85rem' }}>
          Saltar por ahora →
        </Link>
      </form>
    </div>
  )
}
