import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@gym.local' },
    update: {},
    create: {
      email: 'admin@gym.local',
      password: adminPassword,
      name: 'Admin User',
      role: 'admin',
      isActive: true,
    },
  })
  console.log('✅ Admin user created:', admin.email)

  // Create sample teacher
  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@gym.local' },
    update: {},
    create: {
      email: 'teacher@gym.local',
      password: await bcrypt.hash('teacher123', 10),
      name: 'Sample Teacher',
      role: 'teacher',
      isActive: true,
      teacherProfile: {
        create: {
          color: '#0ea5e9',
          bio: 'Experienced fitness instructor',
          specialties: 'Yoga, Pilates',
        },
      },
    },
    include: { teacherProfile: true },
  })
  console.log('✅ Teacher user created:', teacher.email)

  // Create sample spaces
  const spaces = await Promise.all([
    prisma.space.upsert({
      where: { id: 'space-1' },
      update: {},
      create: {
        id: 'space-1',
        name: 'Sala 1',
        description: 'Main training room',
        capacity: 20,
        isActive: true,
      },
    }),
    prisma.space.upsert({
      where: { id: 'space-2' },
      update: {},
      create: {
        id: 'space-2',
        name: 'Sala 2',
        description: 'Yoga and flexibility room',
        capacity: 15,
        isActive: true,
      },
    }),
    prisma.space.upsert({
      where: { id: 'space-3' },
      update: {},
      create: {
        id: 'space-3',
        name: 'Sala 3',
        description: 'CrossFit and strength room',
        capacity: 25,
        isActive: true,
      },
    }),
  ])
  console.log('✅ Spaces created:', spaces.length)

  // Create sample activities
  const activities = await Promise.all([
    prisma.activity.upsert({
      where: { id: 'activity-1' },
      update: {},
      create: {
        id: 'activity-1',
        name: 'Yoga',
        description: 'Relaxing yoga session',
        duration: 60,
        maxClients: 15,
        color: '#10b981',
        isActive: true,
      },
    }),
    prisma.activity.upsert({
      where: { id: 'activity-2' },
      update: {},
      create: {
        id: 'activity-2',
        name: 'Pilates',
        description: 'Core strengthening pilates',
        duration: 50,
        maxClients: 12,
        color: '#f59e0b',
        isActive: true,
      },
    }),
    prisma.activity.upsert({
      where: { id: 'activity-3' },
      update: {},
      create: {
        id: 'activity-3',
        name: 'CrossFit',
        description: 'High-intensity functional training',
        duration: 60,
        maxClients: 20,
        color: '#ef4444',
        isActive: true,
      },
    }),
  ])
  console.log('✅ Activities created:', activities.length)

  // Create app settings
  const settings = await prisma.appSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      gymName: 'Mi Gimnasio',
      primaryColor: '#0ea5e9',
      secondaryColor: '#10b981',
      sessionDuration: 60,
      telegramNotifyAdmin: false,
    },
  })
  console.log('✅ App settings created')

  console.log('✨ Database seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
