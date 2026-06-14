'use client'

import { useFormState } from 'react-dom'
import SubmitButton from '@/components/SubmitButton'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createFood } from '@/lib/actions/foods'

export default function AddFoodPage() {
  const router = useRouter()
  const [state, action] = useFormState(createFood, null)

  if (state?.success) {
    router.push('/foods')
    return null
  }

  return (
    <div className="page-no-nav" style={{ paddingTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Link href="/foods" className="btn btn-ghost" style={{ width: 40, height: 40, minHeight: 40, padding: 0, fontSize: '1.2rem' }}>‹</Link>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Nuevo alimento</h1>
      </div>

      {state?.error && <div className="alert alert-error">{state.error}</div>}

      <form action={action}>
        <div className="form-group">
          <label className="form-label">Nombre *</label>
          <input type="text" name="name" className="form-input" placeholder="Ej: Pechuga de pollo" required />
        </div>
        <div className="form-group">
          <label className="form-label">Marca (opcional)</label>
          <input type="text" name="brand" className="form-input" placeholder="Ej: Hacendado" />
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Valores por 100g/ml</div>

          <div className="form-group">
            <label className="form-label">Calorías (kcal) *</label>
            <input type="number" name="kcalPer100g" className="form-input" placeholder="0" min="0" step="0.1" required />
          </div>

          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Proteínas (g)</label>
              <input type="number" name="proteinG" className="form-input" placeholder="0" min="0" step="0.1" defaultValue="0" required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Hidratos (g)</label>
              <input type="number" name="carbsG" className="form-input" placeholder="0" min="0" step="0.1" defaultValue="0" required />
            </div>
          </div>

          <div className="form-row" style={{ marginTop: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Grasas (g)</label>
              <input type="number" name="fatG" className="form-input" placeholder="0" min="0" step="0.1" defaultValue="0" required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Fibra (g)</label>
              <input type="number" name="fiberG" className="form-input" placeholder="0" min="0" step="0.1" defaultValue="0" />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Ración habitual (g)</label>
          <input type="number" name="servingG" className="form-input" placeholder="100" min="1" defaultValue="100" />
        </div>

        <SubmitButton pendingText="Guardando…" className="btn btn-primary">Guardar alimento</SubmitButton>
      </form>
    </div>
  )
}
