'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import SubmitButton from '@/components/SubmitButton'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { saveGoals, saveProfile } from '@/lib/actions/foods'
import { logout } from '@/lib/actions/auth'

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentario',
  light: 'Ligero (1-3 días/sem)',
  moderate: 'Moderado (3-5 días/sem)',
  active: 'Activo (6-7 días/sem)',
  very_active: 'Muy activo',
}

const GOAL_LABELS: Record<string, string> = {
  lose: 'Perder peso',
  maintain: 'Mantener peso',
  gain: 'Ganar músculo',
}

type TabType = 'goals' | 'profile' | 'account'

export default function ProfilePage() {
  const [tab, setTab] = useState<TabType>('goals')
  const [goalsState, goalsAction] = useFormState(saveGoals, null)
  const [profileState, profileAction] = useFormState(saveProfile, null)

  return (
    <>
      <div className="page">
        <div className="top-bar">
          <h1>Perfil</h1>
        </div>

        <div className="tabs">
          {(['goals', 'profile', 'account'] as TabType[]).map((t) => (
            <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t === 'goals' ? '🎯 Objetivos' : t === 'profile' ? '🏃 Datos' : '👤 Cuenta'}
            </button>
          ))}
        </div>

        {tab === 'goals' && (
          <div className="card">
            <div className="card-title">Objetivos diarios</div>
            {goalsState?.error && <div className="alert alert-error">{goalsState.error}</div>}
            {goalsState?.success && <div className="alert alert-success">Guardado ✓</div>}
            <form action={goalsAction}>
              <div className="form-group">
                <label className="form-label">Calorías (kcal)</label>
                <input type="number" name="kcal" className="form-input" defaultValue={2000} min={800} max={9000} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Proteínas (g)</label>
                  <input type="number" name="proteinG" className="form-input" defaultValue={150} min={0} step={1} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Hidratos (g)</label>
                  <input type="number" name="carbsG" className="form-input" defaultValue={250} min={0} step={1} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Grasas (g)</label>
                  <input type="number" name="fatG" className="form-input" defaultValue={67} min={0} step={1} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Fibra (g)</label>
                  <input type="number" name="fiberG" className="form-input" defaultValue={30} min={0} step={1} />
                </div>
              </div>
              <SubmitButton pendingText="Guardando…" className="btn btn-primary">Guardar objetivos</SubmitButton>
            </form>
          </div>
        )}

        {tab === 'profile' && (
          <div className="card">
            <div className="card-title">Datos personales</div>
            {profileState?.error && <div className="alert alert-error">{profileState.error}</div>}
            {profileState?.success && <div className="alert alert-success">Guardado ✓</div>}
            <form action={profileAction}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Peso (kg)</label>
                  <input type="number" name="weightKg" className="form-input" placeholder="75" min={20} max={500} step={0.1} />
                </div>
                <div className="form-group">
                  <label className="form-label">Altura (cm)</label>
                  <input type="number" name="heightCm" className="form-input" placeholder="175" min={100} max={300} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Año de nacimiento</label>
                <input type="number" name="birthYear" className="form-input" placeholder="1990" min={1920} max={2010} />
              </div>
              <div className="form-group">
                <label className="form-label">Nivel de actividad</label>
                <select name="activityLevel" className="form-select" defaultValue="moderate">
                  {Object.entries(ACTIVITY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Objetivo</label>
                <select name="goal" className="form-select" defaultValue="maintain">
                  {Object.entries(GOAL_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <SubmitButton pendingText="Guardando…" className="btn btn-primary">Guardar datos</SubmitButton>
            </form>
          </div>
        )}

        {tab === 'account' && (
          <div className="card">
            <div className="card-title">Cuenta</div>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: 20 }}>
              Sesión activa en DietBook
            </p>
            <form action={logout}>
              <button type="submit" className="btn btn-danger" style={{ width: '100%' }}>
                Cerrar sesión
              </button>
            </form>
          </div>
        )}
      </div>
      <BottomNav active="/profile" />
    </>
  )
}
