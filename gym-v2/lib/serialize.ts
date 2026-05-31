type BookingWithRelations = {
  startsAt: Date
  endsAt: Date
  createdAt: Date
  updatedAt: Date
  [key: string]: unknown
}

export function serializeBookings<T extends BookingWithRelations>(bookings: T[]) {
  return bookings.map((booking) => ({
    ...booking,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString()
  }))
}
