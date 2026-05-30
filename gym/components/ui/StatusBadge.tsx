const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  available: { label: 'Disponible', cls: 'badge-green',  dot: '#10b981' },
  booked:    { label: 'Reservado',  cls: 'badge-blue',   dot: '#0ea5e9' },
  cancelled: { label: 'Cancelado',  cls: 'badge-red',    dot: '#ef4444' },
  completed: { label: 'Completado', cls: 'badge-gray',   dot: '#94a3b8' },
  blocked:   { label: 'Bloqueado',  cls: 'badge-amber',  dot: '#f59e0b' },
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: 'badge-gray', dot: '#94a3b8' }
  return (
    <span className={s.cls}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
      {s.label}
    </span>
  )
}
