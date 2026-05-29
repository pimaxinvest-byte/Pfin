import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Clear existing data
  await prisma.notificationLog.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.bookingRecurrenceRule.deleteMany()
  await prisma.teacherProfile.deleteMany()
  await prisma.user.deleteMany()
  await prisma.activity.deleteMany()
  await prisma.space.deleteMany()
  await prisma.appSettings.deleteMany()

  // App settings
  await prisma.appSettings.create({
    data: {
      gymName: 'GymBook Pro',
      primaryColor: '#0ea5e9',
      secondaryColor: '#10b981',
      sessionDuration: 60,
      telegramNotifyAdmin: true,
      confirmationText: '¡Tu reserva está confirmada! Te esperamos. 💪',
    },
  })

  // Spaces
  const spaces = await Promise.all([
    prisma.space.create({ data: { name: 'Sala Principal', description: 'Sala grande con equipamiento completo', capacity: 20 } }),
    prisma.space.create({ data: { name: 'Sala Cardio', description: 'Máquinas de cardio', capacity: 10 } }),
    prisma.space.create({ data: { name: 'Sala Spinning', description: 'Sala de cycling indoor', capacity: 15 } }),
    prisma.space.create({ data: { name: 'Sala Yoga', description: 'Sala tranquila para yoga y pilates', capacity: 12 } }),
  ])

  // Activities
  const activities = await Promise.all([
    prisma.activity.create({ data: { name: 'Entrenamiento Personal', duration: 60, maxClients: 1, color: '#0ea5e9' } }),
    prisma.activity.create({ data: { name: 'Yoga', duration: 60, maxClients: 12, color: '#8b5cf6' } }),
    prisma.activity.create({ data: { name: 'Spinning', duration: 45, maxClients: 15, color: '#f59e0b' } }),
    prisma.activity.create({ data: { name: 'Pilates', duration: 60, maxClients: 10, color: '#10b981' } }),
    prisma.activity.create({ data: { name: 'CrossFit', duration: 60, maxClients: 8, color: '#ef4444' } }),
    prisma.activity.create({ data: { name: 'Boxeo', duration: 60, maxClients: 6, color: '#f97316' } }),
  ])

  // Admin
  const adminPwd = await bcrypt.hash('admin123', 12)
  await prisma.user.create({
    data: {
      email: 'admin@gymbook.com',
      password: adminPwd,
      name: 'Administrador',
      role: 'admin',
    },
  })

  // Teachers
  const teacherColors = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b']
  const teacherNames = [
    { name: 'María García', email: 'maria@gymbook.com', specialties: 'Yoga, Pilates', bio: 'Instructora certificada con 8 años de experiencia' },
    { name: 'Carlos López', email: 'carlos@gymbook.com', specialties: 'CrossFit, Entrenamiento Personal', bio: 'Ex atleta profesional, especialista en rendimiento' },
    { name: 'Ana Martínez', email: 'ana@gymbook.com', specialties: 'Spinning, Cardio', bio: 'Campeona regional de ciclismo, instructora de indoor cycling' },
    { name: 'David Rodríguez', email: 'david@gymbook.com', specialties: 'Boxeo, Entrenamiento Funcional', bio: 'Preparador físico especializado en artes marciales' },
  ]

  const teacherPwd = await bcrypt.hash('teacher123', 12)
  const teachers = await Promise.all(
    teacherNames.map((t, i) =>
      prisma.user.create({
        data: {
          email: t.email,
          password: teacherPwd,
          name: t.name,
          role: 'teacher',
          teacherProfile: {
            create: {
              color: teacherColors[i],
              bio: t.bio,
              specialties: t.specialties,
            },
          },
        },
        include: { teacherProfile: true },
      })
    )
  )

  // Clients
  const clientPwd = await bcrypt.hash('client123', 12)
  const clients = await Promise.all([
    prisma.user.create({ data: { email: 'juan@email.com', password: clientPwd, name: 'Juan Pérez', role: 'client' } }),
    prisma.user.create({ data: { email: 'laura@email.com', password: clientPwd, name: 'Laura Sánchez', role: 'client' } }),
    prisma.user.create({ data: { email: 'pedro@email.com', password: clientPwd, name: 'Pedro Jiménez', role: 'client' } }),
  ])

  // Seed some bookings for the next 2 weeks
  const now = new Date()
  const bookings = []

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = new Date(now)
    date.setDate(date.getDate() + dayOffset)

    if (date.getDay() === 0 || date.getDay() === 6) continue // Skip weekends for some

    // Morning slots
    for (let i = 0; i < Math.min(teachers.length, 3); i++) {
      const start = new Date(date)
      start.setHours(9 + i * 2, 0, 0, 0)
      const end = new Date(start)
      end.setHours(end.getHours() + 1)

      const booking = await prisma.booking.create({
        data: {
          teacherId: teachers[i].id,
          spaceId: spaces[i % spaces.length].id,
          activityId: activities[i % activities.length].id,
          startDatetime: start,
          endDatetime: end,
          status: dayOffset < 3 && i === 0 ? 'booked' : 'available',
          clientId: dayOffset < 3 && i === 0 ? clients[0].id : null,
          color: teachers[i].teacherProfile?.color,
          createdBy: teachers[i].id,
        },
      })
      bookings.push(booking)
    }
  }

  console.log(`✅ Seed complete:`)
  console.log(`   - 1 admin (admin@gymbook.com / admin123)`)
  console.log(`   - ${teachers.length} teachers (teacher123)`)
  console.log(`   - ${clients.length} clients (client123)`)
  console.log(`   - ${spaces.length} spaces`)
  console.log(`   - ${activities.length} activities`)
  console.log(`   - ${bookings.length} bookings`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
