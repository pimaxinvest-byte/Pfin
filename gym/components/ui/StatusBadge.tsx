import { cn, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('text-xs font-medium px-2 py-1 rounded-full', STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700')}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
