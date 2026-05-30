import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role')

  const where: any = {}
  if (role) where.role = role
  // Teachers can only see clients
  if (session.user.role === 'teacher') where.role = 'client'
  // Clients can only fetch teachers (limited public fields)
  if (session.user.role === 'client') {
    if (searchParams.get('role') === 'teacher') {
      const teachers = await prisma.user.findMany({
        where: { role: 'teacher' },
        select: {
          id: true,
          name: true,
          teacherProfile: { select: { color: true } },
        },
        orderBy: { name: 'asc' },
      })
      return NextResponse.json(teachers)
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true, name: true, email: true, role: true, isActive: true,
      telegramChatId: true, createdAt: true,
      teacherProfile: { select: { color: true, bio: true, specialties: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(users)
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { email, password, name, role, telegramChatId, color } = await req.json()
    const hashed = await bcrypt.hash(password || 'password123', 12)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        role: role || 'client',
        telegramChatId: telegramChatId || null,
        ...(role === 'teacher' && {
          teacherProfile: { create: { color: color || '#0ea5e9' } },
        }),
      },
      include: { teacherProfile: true },
    })

    return NextResponse.json({ ...user, password: undefined }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
