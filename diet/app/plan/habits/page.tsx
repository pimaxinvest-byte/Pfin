'use client'

import { useFormState } from 'react-dom'
import SubmitButton from '@/components/SubmitButton'
import Link from 'next/link'
import { savePlanHabits, saveCheckin, advanceWeek } from '@/lib/actions/plan'

const DEFAULT_HABITS = [
  'Añadir proteína al desayuno (huevos, yogur o queso)',
  'Preparar comidas del lunes a miércoles el domingo',
  'Sustituir el snack de media tarde por fruta + frutos secos',
  'Revisar progreso y ajustar objetivos',
]

export default function HabitsPage() {
  const [habitsState, habitsAction] = useFormState(savePlanHabits, null)
  const [checkinState, checkinAction] = useFormState(saveCheckin, null)

  return (
    <div className="page-no-nav" style={{ paddingTop: 16, paddingBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Link href="/plan" className="btn btn-ghost" style={{ width: 40, height: 40, minHeight: 40, padding: 0, fontSize: '1.2rem' }}>‹</Link>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Paso 6 de 6</div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>📈 Hábitos graduales</h1>
        </div>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 16, lineHeight: 1.6 }}>
        Cambia una cosa a la vez. Apila hábitos, no dietas nuevas. Un cambio por semana durante 4 semanas es transformador.
      </p>

      {habitsState?.error && <div className="alert alert-error">{habitsState.error}</div>}
      {habitsState?.success && (
        <div className="alert alert-success">
          Plan listo ✓ <Link href="/plan" style={{ color: 'var(--green-dark)', fontWeight: 700 }}>Ver resumen →</Link>
        </div>
      )}

      <form action={habitsAction}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Define un hábito por semana</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
            Sugerencias — modifícalas según tus patrones actuales:
          </div>

          {[1, 2, 3, 4].map((week) => (
            <div key={week} className="form-group" style={week === 4 ? { marginBottom: 0 } : {}}>
              <label className="form-label">
                Semana {week}
                {week === 1 && <span style={{ color: 'var(--green)', marginLeft: 6 }}>← empezar aquí</span>}
                {week === 4 && <span style={{ color: 'var(--muted)', marginLeft: 6 }}>evaluación</span>}
              </label>
              <input
                type="text"
                name={`week${week}Habit`}
                className="form-input"
                defaultValue={DEFAULT_HABITS[week - 1]}
              />
            </div>
          ))}
        </div>

        <SubmitButton pendingText="Guardando…" className="btn btn-primary" style={{ marginBottom: 20 }}>Guardar plan de hábitos</SubmitButton>
      </form>

      {/* Weekly check-in */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Check-in semanal</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 12 }}>
          ¿Qué monitorizar? Energía, hambre, adherencia al plan.
        </p>

        {checkinState?.success && <div className="alert alert-success">Check-in guardado ✓</div>}

        <form action={checkinAction}>
          {[
            { name: 'energy', label: 'Energía general', hint: '1=agotado, 5=excelente' },
            { name: 'hunger', label: 'Control del hambre', hint: '1=hambre constante, 5=sin hambre' },
            { name: 'adherence', label: 'Adherencia al plan', hint: '1=muy pocas comidas, 5=casi todas' },
          ].map((field) => (
            <div key={field.name} className="form-group">
              <label className="form-label">{field.label} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>({field.hint})</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} style={{ flex: 1, textAlign: 'center' }}>
                    <input type="radio" name={field.name} value={n} style={{ display: 'none' }} />
                    <div style={{ padding: '8px 0', border: '1.5px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>{n}</div>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Notas (opcional)</label>
            <input type="text" name="notes" className="form-input" placeholder="¿Qué funcionó? ¿Qué fue difícil?" />
          </div>
          <SubmitButton pendingText="Guardando…" className="btn btn-ghost" style={{ width: '100%' }}>Registrar check-in de esta semana</SubmitButton>
        </form>
      </div>

      <div style={{ background: 'var(--green-light)', borderRadius: 12, padding: '14px 16px', fontSize: '0.85rem', lineHeight: 1.6 }}>
        <strong>Métrica de éxito:</strong> No es la báscula, es la consistencia. Si sigues el plan el 80% de los días durante 4 semanas, los resultados llegan.
        <br /><br />
        <strong>Permiso incorporado:</strong> Una comida fuera del plan por semana es parte del sistema, no un fracaso.
      </div>

      <Link href="/plan" className="btn btn-primary" style={{ display: 'flex', marginTop: 16 }}>
        Ver resumen del plan →
      </Link>
    </div>
  )
}
