import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getClient } from '@/lib/actions/clients'
import { bfCategory, getSupplements, generateWeeklyPlan, CATEGORY_LABELS } from '@/lib/nutrition'
import type { Sex, BuildingCategory } from '@/lib/nutrition'
import BottomNav from '@/components/BottomNav'

const ACTIVITY_ES: Record<string, string> = {
  sedentary: 'Sedentario', light: 'Ligero', moderate: 'Moderado', active: 'Activo', very_active: 'Muy activo',
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
      <span style={{ color: 'var(--muted)', minWidth: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  )
}

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireAuth()
  const client = await getClient(id, session.id)
  if (!client) notFound()

  const last = client.assessments[0]
  const sex = (client.sex ?? 'M') as Sex
  const category = (client.category ?? 'recreational') as BuildingCategory
  const age = client.birthDate ? new Date().getFullYear() - new Date(client.birthDate).getFullYear() : null
  const bf = last?.bodyFatPct
  const bfCat = bf ? bfCategory(bf, sex) : null

  const goal = client.primaryGoal?.toLowerCase().includes('bajar') || client.primaryGoal?.toLowerCase().includes('definir') ? 'lose'
    : client.primaryGoal?.toLowerCase().includes('ganar') || client.primaryGoal?.toLowerCase().includes('volumen') ? 'gain'
    : 'maintain'

  const supplements = getSupplements(goal, category)
  const weekPlan = generateWeeklyPlan(goal, category)
  const essential = supplements.filter(s => s.priority === 'esencial')
  const recommended = supplements.filter(s => s.priority === 'recomendado')

  return (
    <>
      <div className="page">
        {/* Header */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
          <Link href="/clients" className="btn btn-ghost" style={{ width: 40, height: 40, minHeight: 40, padding: 0, fontSize: '1.2rem' }}>‹</Link>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Ficha de cliente</div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{client.name}</h1>
          </div>
          <Link href={`/clients/${id}/assessment`} className="btn btn-primary" style={{ padding: '8px 16px', minHeight: 40, fontSize: '0.85rem', width: 'auto' }}>
            + Valoración
          </Link>
        </div>

        {/* Category badge */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <span style={{ padding: '4px 12px', borderRadius: 999, fontWeight: 700, fontSize: '0.8rem', background: '#dbeafe', color: '#1e40af' }}>
            {CATEGORY_LABELS[category]}
          </span>
          {client.isEnhanced && (
            <span style={{ padding: '4px 12px', borderRadius: 999, fontWeight: 700, fontSize: '0.8rem', background: '#fef3c7', color: '#92400e' }}>
              ⚡ Ciclo activo
            </span>
          )}
          {client.healthCheck && (
            <span style={{ padding: '4px 12px', borderRadius: 999, fontWeight: 700, fontSize: '0.8rem', background: '#dcfce7', color: '#166534' }}>
              ✅ Analítica OK
            </span>
          )}
        </div>

        {/* Latest assessment summary */}
        {last && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title">Última valoración · {last.date}</div>
            <div className="stat-chips">
              {bf != null && (
                <div className="stat-chip" style={{ borderColor: bfCat?.color, borderWidth: 2 }}>
                  <div className="stat-chip-val" style={{ color: bfCat?.color }}>{bf}%</div>
                  <div className="stat-chip-label">% Grasa</div>
                </div>
              )}
              {last.leanMassKg && (
                <div className="stat-chip">
                  <div className="stat-chip-val" style={{ color: 'var(--blue)' }}>{last.leanMassKg}</div>
                  <div className="stat-chip-label">kg Magra</div>
                </div>
              )}
              {last.tdee && (
                <div className="stat-chip">
                  <div className="stat-chip-val" style={{ color: 'var(--orange)' }}>{last.tdee}</div>
                  <div className="stat-chip-label">TDEE kcal</div>
                </div>
              )}
              {last.targetKcal && (
                <div className="stat-chip">
                  <div className="stat-chip-val" style={{ color: 'var(--green-dark)' }}>{last.targetKcal}</div>
                  <div className="stat-chip-label">Objetivo</div>
                </div>
              )}
            </div>
            {last.proteinG && (
              <div style={{ fontSize: '0.78rem', marginTop: 8, color: 'var(--muted)' }}>
                Macros: P:{Math.round(last.proteinG)}g · HC:{last.carbsG ? Math.round(last.carbsG) : '–'}g · G:{last.fatG ? Math.round(last.fatG) : '–'}g
              </div>
            )}
            {bfCat && <span className="badge" style={{ background: `${bfCat.color}22`, color: bfCat.color, marginTop: 6 }}>{bfCat.label}</span>}
          </div>
        )}

        {/* Datos personales */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">Datos personales</div>
          <InfoRow label="Edad" value={age ? `${age} años` : undefined} />
          <InfoRow label="Sexo" value={sex === 'M' ? 'Hombre' : 'Mujer'} />
          <InfoRow label="Email" value={client.email} />
          <InfoRow label="Teléfono" value={client.phone} />
          <InfoRow label="Ciudad" value={client.city} />
          <InfoRow label="Profesión" value={client.occupation} />
          <InfoRow label="Peso actual" value={client.weightKg ? `${client.weightKg} kg` : undefined} />
          <InfoRow label="Altura" value={client.heightCm ? `${client.heightCm} cm` : undefined} />
          <InfoRow label="Peso objetivo" value={client.targetWeightKg ? `${client.targetWeightKg} kg` : undefined} />
          <InfoRow label="Actividad" value={ACTIVITY_ES[client.activityLevel]} />
        </div>

        {/* Objetivo */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">🎯 Objetivo</div>
          <InfoRow label="Principal" value={client.primaryGoal} />
          <InfoRow label="Secundario" value={client.secondaryGoal} />
          <InfoRow label="Competición" value={client.competitionDate} />
        </div>

        {/* Enhanced */}
        {(client.isEnhanced || client.enhancedProtocol) && (
          <div className="card" style={{ marginBottom: 14, borderLeft: '4px solid #7c3aed' }}>
            <div className="card-title">⚡ Terapia farmacológica</div>
            {client.enhancedProtocol && (
              <div style={{ padding: '8px 0', fontSize: '0.875rem' }}>
                <strong>Protocolo:</strong> {client.enhancedProtocol}
              </div>
            )}
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 6, lineHeight: 1.5, background: '#fef3c7', padding: '8px 12px', borderRadius: 8 }}>
              ⚠️ Los cálculos de TDEE (+{category === 'enhanced_comp' ? '18' : '8'}%), proteínas y suplementos se han ajustado para terapia farmacológica.
              Recuerda recomendar analítica cada 3 meses mínimo.
            </div>
          </div>
        )}

        {/* Antecedentes */}
        {(client.medicalHistory || client.foodAllergies || client.injuries || client.medications) && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title">🏥 Antecedentes</div>
            <InfoRow label="Historial médico" value={client.medicalHistory} />
            <InfoRow label="Alergias" value={client.foodAllergies} />
            <InfoRow label="Lesiones" value={client.injuries} />
            <InfoRow label="Medicación" value={client.medications} />
          </div>
        )}

        {/* Suplementos */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">💊 Suplementos recomendados</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 10 }}>
            Basados en objetivo: <strong>{goal === 'lose' ? 'Pérdida de grasa' : goal === 'gain' ? 'Ganancia muscular' : 'Mantenimiento'}</strong> · categoría: <strong>{CATEGORY_LABELS[category]}</strong>
          </div>
          {essential.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--green-dark)', marginBottom: 6 }}>ESENCIALES</div>
              {essential.map((s) => (
                <div key={s.name} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    {s.dose} · {s.timing}
                    {s.note && <> · <em>{s.note}</em></>}
                  </div>
                </div>
              ))}
            </>
          )}
          {recommended.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--blue)', marginTop: 10, marginBottom: 6 }}>RECOMENDADOS</div>
              {recommended.map((s) => (
                <div key={s.name} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                    {s.dose} · {s.timing}
                    {s.note && <> · <em>{s.note}</em></>}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Plan semanal */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">📅 Plan semanal tipo (cocina andaluza)</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 10 }}>Prevalencia de pescado · Variedad diaria</div>
          {Object.entries(weekPlan).map(([day, meals]) => (
            <div key={day} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--green-dark)', marginBottom: 4 }}>{day}</div>
              {[
                { label: '🌅', key: 'breakfast' as const },
                { label: '🥗', key: 'lunch' as const },
                { label: '🌙', key: 'dinner' as const },
                { label: '🍎', key: 'snack' as const },
              ].map(({ label, key }) => (
                <div key={key} style={{ fontSize: '0.78rem', display: 'flex', gap: 6, padding: '3px 0' }}>
                  <span>{label}</span>
                  <span style={{ color: 'var(--text)' }}>{meals[key]}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Historial de valoraciones */}
        {client.assessments.length > 0 && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title">📊 Historial valoraciones</div>
            {client.assessments.map((a) => (
              <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                <div style={{ fontWeight: 600 }}>{a.date} · {a.weightKg}kg</div>
                <div style={{ color: 'var(--muted)', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                  {a.bodyFatPct && <span>Grasa: {a.bodyFatPct}%</span>}
                  {a.leanMassKg && <span>Magra: {a.leanMassKg}kg</span>}
                  {a.tdee && <span>TDEE: {a.tdee}kcal</span>}
                  {a.targetKcal && <span>Obj: {a.targetKcal}kcal</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Notas */}
        {client.trainerNotes && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title">📝 Notas del entrenador</div>
            <div style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>{client.trainerNotes}</div>
          </div>
        )}

        <Link href={`/clients/${id}/assessment`} className="btn btn-primary" style={{ display: 'flex', marginBottom: 8 }}>
          📐 Nueva valoración corporal
        </Link>
        <Link href="/clients" className="btn btn-ghost" style={{ display: 'flex' }}>
          ← Volver a clientes
        </Link>
      </div>
      <BottomNav active="/clients" />
    </>
  )
}
