'use client'

import { useState, useCallback } from 'react'
import { useFormState } from 'react-dom'
import SubmitButton from '@/components/SubmitButton'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { saveAssessment } from '@/lib/actions/assessment'
import { bodyFatYuhasz, bodyFatJP3, bodyFatNavy, bfCategory } from '@/lib/nutrition'
import type { Sex } from '@/lib/nutrition'

type Preview = {
  yuhasz: number | null
  jp3: number | null
  navy: number | null
  sex: Sex
  weight: number
}

function calcPreview(form: Record<string, string>, sex: Sex): Preview {
  const n = (k: string) => { const v = parseFloat(form[k]); return isNaN(v) ? null : v }
  const tri = n('tricepsMm'), sub = n('subscapMm'), abd = n('abdomMm'), sup = n('suprailMm'), thi = n('thighMm')
  const waist = n('waistCm'), hip = n('hipCm'), neck = n('neckCm'), height = n('heightCm') ?? 175
  const weight = n('weightKg') ?? 75

  let yuhasz: number | null = null
  let jp3: number | null = null
  if (tri != null && sub != null && abd != null && sup != null && thi != null) {
    yuhasz = parseFloat(bodyFatYuhasz(tri, sub, abd, sup, thi, sex).toFixed(1))
    jp3 = sex === 'M'
      ? parseFloat(bodyFatJP3(abd, sub, thi, 30, sex).toFixed(1))
      : parseFloat(bodyFatJP3(tri, sup, thi, 30, sex).toFixed(1))
  }
  let navy: number | null = null
  if (waist != null && neck != null) {
    navy = parseFloat(bodyFatNavy(waist, hip, neck, height, sex).toFixed(1))
  }
  return { yuhasz, jp3, navy, sex, weight }
}

export default function NewAssessmentPage() {
  const router = useRouter()
  const [state, action] = useFormState(saveAssessment, null)
  const [sex, setSex] = useState<Sex>('M')
  const [vals, setVals] = useState<Record<string, string>>({})
  const preview = calcPreview(vals, sex)
  const primaryBF = preview.yuhasz ?? preview.navy
  const cat = primaryBF != null ? bfCategory(primaryBF, sex) : null
  const fatKg = primaryBF != null ? preview.weight * primaryBF / 100 : null
  const leanKg = fatKg != null ? preview.weight - fatKg : null

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setVals(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }, [])

  if (state?.success) {
    router.push('/assessment')
    return null
  }

  return (
    <div className="page-no-nav" style={{ paddingTop: 16, paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href="/assessment" className="btn btn-ghost" style={{ width: 40, height: 40, minHeight: 40, padding: 0, fontSize: '1.2rem' }}>‹</Link>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>📐 Nueva valoración</h1>
      </div>

      {/* Live preview */}
      {primaryBF != null && (
        <div className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${cat?.color}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>% Grasa corporal (Yuhász)</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: cat?.color }}>{primaryBF}%</div>
              <span className="badge" style={{ background: `${cat?.color}22`, color: cat?.color }}>{cat?.label}</span>
            </div>
            {leanKg != null && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Masa magra</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{leanKg.toFixed(1)} kg</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 2 }}>Masa grasa</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--orange)' }}>{fatKg!.toFixed(1)} kg</div>
              </div>
            )}
          </div>
          {preview.jp3 != null && (
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              J&P 3 sitios: {preview.jp3}% · Navy: {preview.navy ?? '–'}%
            </div>
          )}
        </div>
      )}

      <form action={action}>
        {/* Sex + date */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">Datos básicos</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Sexo</label>
              <select
                name="sex"
                className="form-select"
                value={sex}
                onChange={e => setSex(e.target.value as Sex)}
              >
                <option value="M">Hombre</option>
                <option value="F">Mujer</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Fecha</label>
              <input
                type="date"
                name="date"
                className="form-input"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Peso (kg)</label>
            <input
              type="number"
              name="weightKg"
              className="form-input"
              placeholder="75.5"
              step="0.1"
              min="20"
              onChange={handleChange}
              style={{ fontWeight: 700, fontSize: '1.1rem' }}
            />
          </div>
        </div>

        {/* Pliegues */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">🔬 Pliegues cutáneos (mm)</div>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
            Protocolo ISAK. Medir lado derecho, músculo relajado. Tomar 2 medidas por sitio y promediar.
          </p>

          {[
            { name: 'tricepsMm', label: 'Tricipital', hint: 'Cara posterior del brazo, punto medio entre acromion y olécranon' },
            { name: 'subscapMm', label: 'Subescapular', hint: 'Ángulo inferior del omóplato, diagonal 45°' },
            { name: 'abdomMm', label: 'Abdominal', hint: 'Lateral al ombligo (5 cm a la derecha), vertical' },
            { name: 'suprailMm', label: 'Supraespinal', hint: 'Por encima de la cresta ilíaca, en línea axilar media' },
            { name: 'thighMm', label: 'Muslo (anterior)', hint: 'Cara anterior del muslo, punto medio entre rodilla e ingle' },
          ].map((f) => (
            <div key={f.name} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ marginBottom: 2 }}>{f.label}</label>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', lineHeight: 1.4 }}>{f.hint}</div>
                </div>
                <input
                  type="number"
                  name={f.name}
                  className="form-input"
                  placeholder="mm"
                  min="1"
                  step="0.5"
                  onChange={handleChange}
                  style={{ width: 80, textAlign: 'center', fontWeight: 700 }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Perímetros */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">📏 Perímetros (cm)</div>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
            Cinta métrica en contacto con la piel, sin comprimir. Se usan para el método US Navy.
          </p>

          {[
            { name: 'waistCm', label: 'Cintura / Abdominal', hint: 'A nivel del ombligo' },
            { name: 'hipCm', label: 'Cadera', hint: 'Punto de mayor diámetro (solo mujeres para Navy)' },
            { name: 'neckCm', label: 'Cuello', hint: 'Justo debajo de la nuez' },
            { name: 'armCm', label: 'Brazo (bíceps)', hint: 'Brazo flexionado contraído, punto máximo' },
            { name: 'calfCm', label: 'Pantorrilla', hint: 'Punto de mayor diámetro' },
          ].map((f) => (
            <div key={f.name} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>{f.label}</label>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{f.hint}</div>
              </div>
              <input
                type="number"
                name={f.name}
                className="form-input"
                placeholder="cm"
                min="10"
                step="0.5"
                onChange={handleChange}
                style={{ width: 80, textAlign: 'center', fontWeight: 700 }}
              />
            </div>
          ))}
        </div>

        {state?.error && <div className="alert alert-error">{state.error}</div>}

        <SubmitButton pendingText="Calculando y guardando…" className="btn btn-primary">Guardar valoración</SubmitButton>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'center', marginTop: 10 }}>
          Los objetivos de kcal y macros se actualizarán automáticamente según tu TDEE.
        </div>
      </form>
    </div>
  )
}
