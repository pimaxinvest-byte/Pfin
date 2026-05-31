import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { createSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export async function POST(req: Request) {
  const data = loginSchema.parse(await req.json())
  const user = await prisma.user.findUnique({ where: { email: data.email } })

  if (!user?.isActive) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  const valid = await bcrypt.compare(data.password, user.password)
  if (!valid) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role })
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } })
}
