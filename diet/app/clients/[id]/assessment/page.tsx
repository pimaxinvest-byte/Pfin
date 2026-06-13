'use client'

import { useActionState, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { saveClientAssessment } from '@/lib/actions/clients'
import { bodyFatYuhasz, bodyFatJP3, bodyFatNavy, bfCategory } from '@/lib/nutrition'
import type { Sex } from '@/lib/nutrition'

export default function ClientAssessmentPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [state, action, pending] = useActionState(saveClientAssessment, null)
  const [sex, setSex] = useState<Sex>('M')
  const [vals, setVals] = useState<Record<string, string>>({})

  const n = (k: string) => { const v = parseFloat(vals[k]); return isNaN(v) ? null : v }
  const tri = n('tricepsMm'), sub = n('subscapMm'), abd = n('abdomMm'), sup = n('suprailMm'), thi = n('thighMm')
  const waist = n('waistCm'), hip = n('hipCm'), neck = n('neckCm')

  let yuhasz: number | null = null, jp3: number | null = null, navy: number | null = null
  if (tri != null && sub != null && abd != null && sup != null && thi != null) {
    yuhasz = parseFloat(bodyFatYuhasz(tri, sub, abd, sup, thi, sex).toFixed(1))
    jp3 = sex === 'M'
      ? parseFloat(bodyFatJP3(abd, sub, thi, 30, sex).toFixed(1))
      : parseFloat(bodyFatJP3(tri, sup, thi, 30, sex).toFixed(1))
  }
  if (waist != null && neck != null) navy = parseFloat(bodyFatNavy(waist, hip, neck, 175, sex).toFixed(1))

  const primary = yuhasz ?? navy
  const cat = primary != null ? bfCategory(primary, sex) : null
  const w = n('weightKg') ?? 80
  const fatKg = primary != null ? w * primary / 100 : null
  const leanKg = fatKg != null ? w - fatKg : null

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setVals(p => ({ ...p, [e.target.name]: e.target.value }))
    if (e.target.name === 'sex') setSex(e.target.value as Sex)
  }, [])

  if (state?.success) {
    router.push(`/clients/${id}`)
    return null
  }

  return (
    <div className="page-no-nav" style={{ paddingTop: 16, paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href={`/clients/${id}`} className="btn btn-ghost" style={{ width: 40, height: 40, minHeight: 40, padding: 0, fontSize: '1.2rem' }}>‹</Link>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>📐 Valoración corporal</h1>
      </div>

      {/* Live result */}
      {primary != null && (
        <div className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${cat?.color}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>% Grasa (Yuhász)</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: cat?.color, lineHeight: 1 }}>{primary}%</div>
              <span className="badge" style={{ background: `${cat?.color}22`, color: cat?.color }}>{cat?.label}</span>
            </div>
            {leanKg != null && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Magra</div>
                <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--blue)' }}>{leanKg.toFixed(1)} kg</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 4 }}>Grasa</div>
                <div style={{ fontWeight: 700, color: 'var(--orange)' }}>{fatKg!.toFixed(1)} kg</div>
              </div>
            )}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 8 }}>
            {jp3 != null && `J&P: ${jp3}% · `}{navy != null && `Navy: ${navy}%`}
          </div>
        </div>
      )}

      <form action={action}>
        <input type="hidden" name="clientId" value={id} />

        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">Datos básicos</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fecha</label>
              <input type="date" name="date" className="form-input" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="form-group">
              <label className="form-label">Sexo</label>
              <select name="sex" className="form-select" value={sex} onChange={onChange}>
                <option value="M">Hombre</option>
                <option value="F">Mujer</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Peso (kg)</label>
              <input type="number" name="weightKg" className="form-input" placeholder="80" step="0.1" onChange={onChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Talla (cm)</label>
              <input type="number" name="heightCm" className="form-input" placeholder="178" onChange={onChange} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">🔬 Pliegues cutáneos (mm) · Protocolo ISAK</div>
          {[
            { name: 'tricepsMm', label: 'Tricipital', hint: 'Cara posterior brazo, punto medio' },
            { name: 'subscapMm', label: 'Subescapular', hint: 'Ángulo inferior omóplato, 45°' },
            { name: 'abdomMm', label: 'Abdominal', hint: '5 cm lateral ombligo, vertical' },
            { name: 'suprailMm', label: 'Supraespinal', hint: 'Sobre cresta ilíaca, línea axilar media' },
            { name: 'thighMm', label: 'Muslo anterior', hint: 'Punto medio rodilla-ingle' },
          ].map((f) => (
            <div key={f.name} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ marginBottom: 1 }}>{f.label}</label>
                <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{f.hint}</div>
              </div>
              <input type="number" name={f.name} className="form-input" placeholder="mm" min="1" step="0.5" onChange={onChange}
                style={{ width: 80, textAlign: 'center', fontWeight: 700, padding: '10px 8px' }} />
            </div>
          ))}
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">📏 Perímetros (cm)</div>
          {[
            { name: 'waistCm', label: 'Cintura abdominal', hint: 'A nivel del ombligo' },
            { name: 'hipCm', label: 'Cadera', hint: 'Punto máximo, eje horizontal' },
            { name: 'neckCm', label: 'Cuello', hint: 'Bajo la nuez' },
            { name: 'chestCm', label: 'Pecho', hint: 'Línea de pezones (inspiración media)' },
            { name: 'armCm', label: 'Bíceps contraído', hint: 'Punto máximo brazo flexionado' },
            { name: 'thighCm', label: 'Muslo', hint: 'Punto máximo muslo derecho' },
            { name: 'calfCm', label: 'Pantorrilla', hint: 'Punto máximo gemelo' },
          ].map((f) => (
            <div key={f.name} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ marginBottom: 1 }}>{f.label}</label>
                <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{f.hint}</div>
              </div>
              <input type="number" name={f.name} className="form-input" placeholder="cm" min="10" step="0.5" onChange={onChange}
                style={{ width: 80, textAlign: 'center', fontWeight: 700, padding: '10px 8px' }} />
            </div>
          ))}
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Notas de sesión</div>
          <input type="text" name="notes" className="form-input" placeholder="Estado del cliente, observaciones…" />
        </div>

        {state?.error && <div className="alert alert-error">{state.error}</div>}

        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Calculando…' : 'Guardar valoración'}
        </button>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'center', marginTop: 10 }}>
          Se calculan: % grasa (Yuhász + JP3 + Navy), BMI, BMR, TDEE, TDEE ajustado por categoría, macros óptimas.
        </div>
      </form>
    </div>
  )
}
