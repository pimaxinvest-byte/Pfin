import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.literal('client').optional().default('client'),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const data = registerSchema.parse(body)

    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) {
      return NextResponse.json({ error: 'El email ya está registrado' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(data.password, 12)
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashed,
        name: data.name,
        role: data.role,
      },
    })

    return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error al registrar' }, { status: 400 })
  }
}
