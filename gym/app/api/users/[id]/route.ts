import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Users can view their own profile, admin can view all
  if (session.user.role !== 'admin' && session.user.id !== params.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, email: true, role: true, isActive: true,
      telegramChatId: true, createdAt: true,
      teacherProfile: { select: { color: true, bio: true, specialties: true } },
    },
  })
  if (!user) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  return NextResponse.json(user)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.user.role !== 'admin' && session.user.id !== params.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { name, email, password, role, isActive, telegramChatId, color, bio, specialties } = await req.json()

    const updateData: any = {}
    if (name) updateData.name = name
    if (email) updateData.email = email
    if (password) updateData.password = await bcrypt.hash(password, 12)
    if (telegramChatId !== undefined) updateData.telegramChatId = telegramChatId
    if (session.user.role === 'admin') {
      if (role) updateData.role = role
      if (isActive !== undefined) updateData.isActive = isActive
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...updateData,
        ...(color !== undefined && {
          teacherProfile: {
            upsert: {
              create: { color },
              update: { color },
            },
          },
        }),
        ...(bio !== undefined && {
          teacherProfile: {
            upsert: {
              create: { bio },
              update: { bio },
            },
          },
        }),
      },
      include: { teacherProfile: true },
    })

    return NextResponse.json({ ...user, password: undefined })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.user.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
