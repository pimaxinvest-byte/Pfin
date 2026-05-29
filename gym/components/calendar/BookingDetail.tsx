'use client'

import { Modal } from '@/components/ui/Modal'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDateTimeDisplay, formatTime } from '@/lib/utils'
import type { BookingWithRelations } from '@/lib/types'

interface BookingDetailProps {
  booking: BookingWithRelations | null
  onClose: () => void
  onBook?: (booking: BookingWithRelations) => void
  onCancel?: (booking: BookingWithRelations) => void
  onDelete?: (booking: BookingWithRelations) => void
  role?: string
  userId?: string
}

export function BookingDetail({ booking, onClose, onBook, onCancel, onDelete, role, userId }: BookingDetailProps) {
  if (!booking) return null

  const canBook = role === 'client' && booking.status === 'available'
  const canCancel =
    (role === 'client' && booking.clientId === userId && booking.status === 'booked') ||
    ((role === 'teacher' || role === 'admin') && booking.status !== 'cancelled')
  const canDelete = role === 'admin'

  return (
    <Modal open={!!booking} onClose={onClose} title="Detalle de reserva">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <StatusBadge status={booking.status} />
          <span className="text-xs text-gray-400">#{booking.id.slice(-8).toUpperCase()}</span>
        </div>

        <div className="space-y-3">
          <Row icon="👨‍🏫" label="Profesor" value={booking.teacher.name} />
          {booking.client && <Row icon="👤" label="Cliente" value={booking.client.name} />}
          <Row icon="🏋️" label="Actividad" value={booking.activity.name} />
          <Row icon="📍" label="Espacio" value={booking.space.name} />
          <Row icon="🗓" label="Día" value={formatDateTimeDisplay(booking.startDatetime)} />
          <Row icon="⏰" label="Hora" value={`${formatTime(booking.startDatetime)} - ${formatTime(booking.endDatetime)}`} />
          {booking.notes && <Row icon="📝" label="Notas" value={booking.notes} />}
        </div>

        <div className="flex flex-col gap-2 pt-2">
          {canBook && onBook && (
            <button className="btn-primary" onClick={() => onBook(booking)}>
              Reservar esta sesión
            </button>
          )}
          {canCancel && onCancel && (
            <button className="btn-secondary text-red-500 border-red-200" onClick={() => onCancel(booking)}>
              Cancelar reserva
            </button>
          )}
          {canDelete && onDelete && (
            <button className="btn-danger" onClick={() => onDelete(booking)}>
              Eliminar
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-lg w-6">{icon}</span>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  )
}
