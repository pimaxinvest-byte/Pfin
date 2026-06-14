'use client'

import { useFormState } from 'react-dom'
import SubmitButton from '@/components/SubmitButton'
import Link from 'next/link'
import { createClient } from '@/lib/actions/clients'

export default function NewClientPage() {
  const [state, action] = useFormState(createClient, null)

  return (
    <div className="page-no-nav" style={{ paddingTop: 16, paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Link href="/clients" className="btn btn-ghost" style={{ width: 40, height: 40, minHeight: 40, padding: 0, fontSize: '1.2rem' }}>‹</Link>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>📋 Nueva ficha de cliente</h1>
      </div>

      {state?.error && <div className="alert alert-error">{state.error}</div>}

      <form action={action}>
        {/* Datos personales */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">Datos personales</div>
          <div className="form-group">
            <label className="form-label">Nombre completo *</label>
            <input type="text" name="name" className="form-input" placeholder="Juan García López" required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" name="email" className="form-input" placeholder="email@ejemplo.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input type="tel" name="phone" className="form-input" placeholder="600 000 000" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fecha nacimiento</label>
              <input type="date" name="birthDate" className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">Sexo</label>
              <select name="sex" className="form-select">
                <option value="M">Hombre</option>
                <option value="F">Mujer</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Profesión</label>
              <input type="text" name="occupation" className="form-input" placeholder="Empleado de oficina" />
            </div>
            <div className="form-group">
              <label className="form-label">Ciudad</label>
              <input type="text" name="city" className="form-input" placeholder="Sevilla" />
            </div>
          </div>
        </div>

        {/* Datos morfológicos */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">Datos morfológicos</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Peso actual (kg)</label>
              <input type="number" name="weightKg" className="form-input" placeholder="80" step="0.1" min="30" />
            </div>
            <div className="form-group">
              <label className="form-label">Altura (cm)</label>
              <input type="number" name="heightCm" className="form-input" placeholder="178" min="130" max="220" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Peso objetivo (kg)</label>
            <input type="number" name="targetWeightKg" className="form-input" placeholder="75" step="0.1" min="30" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Nivel de actividad</label>
            <select name="activityLevel" className="form-select">
              <option value="sedentary">Sedentario (trabajo de escritorio, sin ejercicio)</option>
              <option value="light">Ligero (1-3 días/semana)</option>
              <option value="moderate" selected>Moderado (3-5 días/semana)</option>
              <option value="active">Activo (6-7 días/semana)</option>
              <option value="very_active">Muy activo (doble sesión diaria)</option>
            </select>
          </div>
        </div>

        {/* Objetivo y categoría */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">🎯 Objetivo y categoría</div>
          <div className="form-group">
            <label className="form-label">Objetivo principal</label>
            <input type="text" name="primaryGoal" className="form-input" placeholder="Ej: Perder 10kg para julio, competir en natural, ganar músculo" />
          </div>
          <div className="form-group">
            <label className="form-label">Objetivo secundario</label>
            <input type="text" name="secondaryGoal" className="form-input" placeholder="Ej: Mejorar energía, reducir % grasa" />
          </div>
          <div className="form-group">
            <label className="form-label">Categoría / modalidad</label>
            <select name="category" className="form-select">
              <option value="beginner">🟢 Principiante</option>
              <option value="recreational">🔵 Recreativo / Fitness</option>
              <option value="natural_comp">🏆 Competición Natural</option>
              <option value="enhanced_comp">⚡ Competición Enhanced / Farmacológico</option>
              <option value="trt">💉 TRT (Terapia de Reemplazo Hormonal)</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Fecha de competición (si aplica)</label>
            <input type="date" name="competitionDate" className="form-input" />
          </div>
        </div>

        {/* Terapia anabólica */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">⚠️ Terapia farmacológica</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
            <input type="checkbox" name="isEnhanced" id="isEnhanced" style={{ width: 20, height: 20, marginTop: 2, accentColor: 'var(--purple)', flexShrink: 0 }} />
            <div>
              <label htmlFor="isEnhanced" style={{ fontWeight: 600 }}>Ciclo anabólico activo</label>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Marca si el cliente está en ciclo activo. Ajusta automáticamente TDEE y proteínas.</div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Protocolo / medicación (confidencial)</label>
            <input type="text" name="enhancedProtocol" className="form-input" placeholder="Ej: TRT 150mg/sem + Anavar 50mg/día" />
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <input type="checkbox" name="healthCheck" id="healthCheck" style={{ width: 20, height: 20, marginTop: 2, accentColor: 'var(--green)', flexShrink: 0 }} />
            <label htmlFor="healthCheck" style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              ✅ El cliente ha realizado analítica reciente (hepatograma, hemograma, lipidograma)
            </label>
          </div>
        </div>

        {/* Antecedentes */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">🏥 Antecedentes</div>
          <div className="form-group">
            <label className="form-label">Historial médico relevante</label>
            <input type="text" name="medicalHistory" className="form-input" placeholder="Ej: Diabetes tipo 2, hipertensión, tiroides" />
          </div>
          <div className="form-group">
            <label className="form-label">Alergias alimentarias</label>
            <input type="text" name="foodAllergies" className="form-input" placeholder="Ej: Gluten, lactosa, frutos secos" />
          </div>
          <div className="form-group">
            <label className="form-label">Lesiones activas</label>
            <input type="text" name="injuries" className="form-input" placeholder="Ej: Tendinitis hombro derecho, lumbalgia" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Medicación actual</label>
            <input type="text" name="medications" className="form-input" placeholder="Ej: Omeprazol, metformina" />
          </div>
        </div>

        {/* Notas */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Notas del entrenador</div>
          <textarea name="trainerNotes" className="form-input" placeholder="Observaciones, motivación del cliente, historial de dietas…" rows={3} style={{ resize: 'vertical' }} />
        </div>

        <SubmitButton pendingText="Creando ficha…" className="btn btn-primary">Crear ficha de cliente</SubmitButton>
      </form>
    </div>
  )
}
