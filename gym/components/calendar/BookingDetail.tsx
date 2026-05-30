'use client'

import { Modal } from '@/components/ui/Modal'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDateTimeDisplay, formatTime, hexToRgba } from '@/lib/utils'
import type { BookingWithRelations } from '@/lib/types'

interface BookingDetailProps {
  booking: BookingWithRelations | null
  onClose: () => void
  onBook?: (b: BookingWithRelations) => void
  onCancel?: (b: BookingWithRelations) => void
  onDelete?: (b: BookingWithRelations) => void
  role?: string
  userId?: string
}

export function BookingDetail({ booking, onClose, onBook, onCancel, onDelete, role, userId }: BookingDetailProps) {
  if (!booking) return null

  const color = booking.color ?? booking.teacher.teacherProfile?.color ?? '#6366f1'
  const canBook   = role === 'client' && booking.status === 'available'
  const canCancel = (role === 'client' && booking.clientId === userId && booking.status === 'booked')
                 || (['teacher', 'admin'].includes(role ?? '') && !['cancelled'].includes(booking.status))
  const canDelete = role === 'admin'

  return (
    <Modal open={!!booking} onClose={onClose} title="Detalle de reserva">
      <div className="space-y-5 animate-fade-in">

        {/* Color banner */}
        <div
          className="rounded-2xl px-4 py-3 flex items-center justify-between"
          style={{ background: hexToRgba(color, 0.12) }}
        >
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-sm font-bold" style={{ color }}>{booking.activity.name}</span>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        {/* Details */}
        <div className="space-y-0 divide-y divide-[var(--border)]">
          <Row icon="👨‍🏫" label="Profesor"  value={booking.teacher.name} />
          {booking.client && <Row icon="👤" label="Cliente" value={booking.client.name} />}
          <Row icon="📍" label="Espacio"    value={booking.space.name} />
          <Row icon="🗓" label="Día"        value={formatDateTimeDisplay(booking.startDatetime)} />
          <Row icon="⏰" label="Hora"       value={`${formatTime(booking.startDatetime)} – ${formatTime(booking.endDatetime)}`} />
          {booking.notes && <Row icon="📝" label="Notas" value={booking.notes} />}
        </div>

        <p className="text-[11px] text-[var(--ink-3)] text-center font-mono">
          #{booking.id.slice(-10).toUpperCase()}
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2.5 pt-1">
          {canBook && onBook && (
            <button className="btn-primary" onClick={() => onBook(booking)}>
              ✓ Reservar esta sesión
            </button>
          )}
          {canCancel && onCancel && (
            <button
              className="btn w-full py-4 text-sm font-semibold rounded-full text-red-600 border border-red-200 bg-red-50"
              onClick={() => onCancel(booking)}
            >
              Cancelar reserva
            </button>
          )}
          {canDelete && onDelete && (
            <button className="btn-danger" onClick={() => onDelete(booking)}>Eliminar</button>
          )}
          <button className="btn-ghost w-full py-3 text-sm" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="text-base w-6 flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-0.5">{label}</p>
        <p className="text-sm font-medium text-[var(--ink)]">{value}</p>
      </div>
    </div>
  )
}
