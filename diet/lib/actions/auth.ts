'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '../db'
import { createSession, destroySession, getSession, roleForEmail } from '../auth'
import type { FormState } from '../form-state'
import type { Role } from '../auth'

export async function getMyRole(): Promise<Role | null> {
  const session = await getSession()
  return session?.role ?? null
}

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const RegisterSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(6),
})

export async function login(_prev: unknown, form: FormData): Promise<FormState> {
  const parsed = LoginSchema.safeParse({
    email: form.get('email'),
    password: form.get('password'),
  })
  if (!parsed.success) return { error: 'Datos inválidos' }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } })
  if (!user) return { error: 'Email o contraseña incorrectos' }

  const ok = await bcrypt.compare(parsed.data.password, user.password)
  if (!ok) return { error: 'Email o contraseña incorrectos' }

  await createSession({ id: user.id, email: user.email, name: user.name, role: roleForEmail(user.email) })
  redirect('/dashboard')
}

export async function register(_prev: unknown, form: FormData): Promise<FormState> {
  const parsed = RegisterSchema.safeParse({
    name: form.get('name'),
    email: form.get('email'),
    password: form.get('password'),
  })
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const exists = await db.user.findUnique({ where: { email: parsed.data.email } })
  if (exists) return { error: 'Email ya registrado' }

  const hash = await bcrypt.hash(parsed.data.password, 10)
  const user = await db.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      password: hash,
      goals: { create: { kcal: 2000, proteinG: 150, carbsG: 250, fatG: 67, fiberG: 30 } },
      profile: { create: {} },
    },
  })

  await createSession({ id: user.id, email: user.email, name: user.name, role: roleForEmail(user.email) })
  redirect('/dashboard')
}

export async function logout() {
  await destroySession()
  redirect('/login')
}
