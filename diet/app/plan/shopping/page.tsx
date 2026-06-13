'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { savePlanShopping } from '@/lib/actions/plan'

const SHOPPING_TEMPLATE = {
  'Proteínas': ['Pollo, pavo o ternera (500g-1kg)', 'Huevos (12u)', 'Atún en lata (4 latas)', 'Yogur griego (pack)', 'Legumbres: lentejas o garbanzos'],
  'Verduras': ['Bolsa de ensalada', 'Brócoli o coliflor', 'Tomates', 'Cebolla, ajo, pimiento', 'Espinacas o kale'],
  'Carbohidratos': ['Arroz o pasta integral', 'Pan integral', 'Avena', 'Patatas o boniatos'],
  'Grasas saludables': ['Aceite de oliva extra virgen', 'Aguacates', 'Frutos secos (almendras, nueces)'],
  'Frutas': ['Manzanas o peras', 'Plátanos', 'Frutos rojos (congelados OK)'],
  'Despensa': ['Especias y hierbas', 'Caldo sin sal', 'Conservas (tomate triturado, legumbres)'],
}

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export default function ShoppingPage() {
  const [state, action, pending] = useActionState(savePlanShopping, null)

  return (
    <div className="page-no-nav" style={{ paddingTop: 16, paddingBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Link href="/plan" className="btn btn-ghost" style={{ width: 40, height: 40, minHeight: 40, padding: 0, fontSize: '1.2rem' }}>‹</Link>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Paso 5 de 6</div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>🛒 Compra semanal</h1>
        </div>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 16, lineHeight: 1.6 }}>
        Si la comida sana no está en casa, el plan falla. Si la comida basura está en casa, la fuerza de voluntad falla.
      </p>

      {state?.error && <div className="alert alert-error">{state.error}</div>}
      {state?.success && (
        <div className="alert alert-success">
          Guardado ✓ <Link href="/plan/habits" style={{ color: 'var(--green-dark)', fontWeight: 700 }}>→ Último paso</Link>
        </div>
      )}

      <form action={action}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Logística</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Día de compra</label>
              <select name="shoppingDay" className="form-select">
                <option value="">Elegir…</option>
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Día de prep</label>
              <select name="prepDay" className="form-select">
                <option value="">Elegir…</option>
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
            Consejo: nunca vayas al supermercado con hambre. Compra el mismo día cada semana.
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={pending} style={{ marginBottom: 20 }}>
          {pending ? 'Guardando…' : 'Guardar logística'}
        </button>
      </form>

      {/* Shopping list template */}
      <div className="card-title" style={{ marginBottom: 12 }}>Lista base semanal</div>
      {Object.entries(SHOPPING_TEMPLATE).map(([cat, items]) => (
        <div key={cat} className="card" style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 8 }}>{cat}</div>
          {items.map((item) => (
            <div key={item} style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <div style={{ width: 20, height: 20, border: '1.5px solid var(--border)', borderRadius: 4, flexShrink: 0 }} />
              <span style={{ fontSize: '0.88rem' }}>{item}</span>
            </div>
          ))}
        </div>
      ))}

      <Link href="/plan/habits" className="btn btn-primary" style={{ display: 'flex', marginTop: 8 }}>
        Siguiente: Hábitos graduales →
      </Link>
    </div>
  )
}
