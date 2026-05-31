import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 12)
  const teacherPassword = await bcrypt.hash('teacher123', 12)
  const clientPassword = await bcrypt.hash('client123', 12)

  const [admin, teacher, client] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@gymbook.com' },
      update: {},
      create: { email: 'admin@gymbook.com', password: adminPassword, name: 'Admin', role: 'admin' }
    }),
    prisma.user.upsert({
      where: { email: 'maria@gymbook.com' },
      update: {},
      create: { email: 'maria@gymbook.com', password: teacherPassword, name: 'Maria Garcia', role: 'teacher' }
    }),
    prisma.user.upsert({
      where: { email: 'cliente@gymbook.com' },
      update: {},
      create: { email: 'cliente@gymbook.com', password: clientPassword, name: 'Cliente Demo', role: 'client' }
    })
  ])

  const space = await prisma.space.upsert({
    where: { id: 'demo-space' },
    update: {},
    create: { id: 'demo-space', name: 'Sala Principal', capacity: 10 }
  })

  const activity = await prisma.activity.upsert({
    where: { id: 'demo-activity' },
    update: {},
    create: { id: 'demo-activity', name: 'Entrenamiento', duration: 60, color: '#2563eb' }
  })

  const startsAt = new Date()
  startsAt.setDate(startsAt.getDate() + 1)
  startsAt.setHours(10, 0, 0, 0)
  const endsAt = new Date(startsAt)
  endsAt.setHours(11, 0, 0, 0)

  await prisma.booking.upsert({
    where: { id: 'demo-booking' },
    update: {},
    create: {
      id: 'demo-booking',
      teacherId: teacher.id,
      spaceId: space.id,
      activityId: activity.id,
      startsAt,
      endsAt,
      status: 'available',
      notes: `Seed created by ${admin.name}; sample client is ${client.name}`
    }
  })
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
