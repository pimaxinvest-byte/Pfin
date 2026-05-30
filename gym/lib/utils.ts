import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addWeeks,
  addDays,
  isSameDay,
  parseISO,
} from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string, fmt = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt, { locale: es })
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'HH:mm', { locale: es })
}

export function formatDateTimeDisplay(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, "EEEE d 'de' MMMM, HH:mm", { locale: es })
}

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  const end = endOfWeek(date, { weekStartsOn: 1 })
  return eachDayOfInterval({ start, end })
}

export function getMonthDays(date: Date): Date[] {
  const start = startOfMonth(date)
  const end = endOfMonth(date)
  return eachDayOfInterval({ start, end })
}

export function getMonthGrid(date: Date): (Date | null)[] {
  const start = startOfMonth(date)
  const end = endOfMonth(date)
  const days = eachDayOfInterval({ start, end })

  const firstDayOfWeek = start.getDay()
  const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1

  const grid: (Date | null)[] = Array(offset).fill(null)
  return grid.concat(days)
}

export function generateRecurringDates(
  daysOfWeek: number[],
  startDate: Date,
  endDate: Date
): Date[] {
  const dates: Date[] = []
  let current = new Date(startDate)

  while (current <= endDate) {
    if (daysOfWeek.includes(current.getDay())) {
      dates.push(new Date(current))
    }
    current = addDays(current, 1)
  }

  return dates
}

export function hexToRgba(hex: string, alpha = 1): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  booked: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-gray-100 text-gray-800',
  blocked: 'bg-yellow-100 text-yellow-800',
}

export const STATUS_LABELS: Record<string, string> = {
  available: 'Disponible',
  booked: 'Reservado',
  cancelled: 'Cancelado',
  completed: 'Completado',
  blocked: 'Bloqueado',
}

export const DAY_NAMES_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
export const DAY_NAMES_FULL_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
export const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
