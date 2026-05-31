import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createSession } from '@/lib/auth'

const setupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6)
})

export async function GET() {
  const count = await prisma.user.count()
  return NextResponse.json({ needsSetup: count === 0 })
}

export async function POST(req: Request) {
  const count = await prisma.user.count()
  if (count > 0) {
    return NextResponse.json({ error: 'La app ya esta configurada' }, { status: 409 })
  }

  const data = setupSchema.parse(await req.json())
  const password = await bcrypt.hash(data.password, 12)
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, password, role: 'admin' }
  })

  await createSession({ id: user.id, name: user.name, email: user.email, role: user.role })
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } })
}
