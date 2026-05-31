import { cookies } from 'next/headers'
import crypto from 'node:crypto'
import type { Role } from '@prisma/client'
import { prisma } from './prisma'

const cookieName = 'gymbook_session'

function sessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 24) {
    throw new Error('SESSION_SECRET must be at least 24 characters')
  }
  return secret
}

export type SessionUser = {
  id: string
  email: string
  name: string
  role: Role
}

export async function createSession(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify({
    ...user,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7
  })).toString('base64url')
  const signature = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
  const token = `${payload}.${signature}`

  cookies().set(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  })
}

export function clearSession() {
  cookies().delete(cookieName)
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(cookieName)?.value
  if (!token) return null

  try {
    const [payload, signature] = token.split('.')
    if (!payload || !signature) return null

    const expected = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
    if (signature.length !== expected.length) return null
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null

    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionUser & { expiresAt: number }
    if (session.expiresAt < Date.now()) return null

    const id = String(session.id)
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, isActive: true }
    })
    if (!user?.isActive) return null
    return { id: user.id, email: user.email, name: user.name, role: user.role }
  } catch {
    return null
  }
}

export async function requireUser(roles?: Role[]) {
  const user = await getSessionUser()
  if (!user) throw new Error('UNAUTHORIZED')
  if (roles && !roles.includes(user.role)) throw new Error('FORBIDDEN')
  return user
}
