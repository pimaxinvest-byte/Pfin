import type { Role, BookingStatus } from '@prisma/client'

export type { Role, BookingStatus }

export interface BookingWithRelations {
  id: string
  teacherId: string
  clientId: string | null
  spaceId: string
  activityId: string
  startDatetime: Date
  endDatetime: Date
  status: BookingStatus
  color: string | null
  notes: string | null
  recurrenceId: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
  teacher: {
    id: string
    name: string
    email: string
    telegramChatId: string | null
    teacherProfile: { color: string } | null
  }
  client: {
    id: string
    name: string
    email: string
    telegramChatId: string | null
  } | null
  space: { id: string; name: string }
  activity: { id: string; name: string; color: string }
}

export interface CreateBookingInput {
  teacherId: string
  clientId?: string
  spaceId: string
  activityId: string
  startDatetime: string
  endDatetime: string
  status?: BookingStatus
  notes?: string
}

export interface CreateRecurringInput {
  teacherId: string
  spaceId: string
  activityId: string
  daysOfWeek: number[]
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  notes?: string
}

export interface FilterParams {
  teacherId?: string
  clientId?: string
  activityId?: string
  spaceId?: string
  status?: BookingStatus
  startDate?: string
  endDate?: string
}
