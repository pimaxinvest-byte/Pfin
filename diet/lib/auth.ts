import { cookies } from 'next/headers'
import { db } from './db'

const SESSION_COOKIE = 'diet_session'
const MAX_AGE = 60 * 60 * 24 * 30

export type SessionUser = {
  id: string
  email: string
  name: string
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies()
  const raw = store.get(SESSION_COOKIE)?.value
  if (!raw) return null
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as SessionUser
  } catch {
    return null
  }
}

export async function createSession(user: SessionUser) {
  const store = await cookies()
  const encoded = Buffer.from(JSON.stringify(user)).toString('base64')
  store.set(SESSION_COOKIE, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  })
}

export async function destroySession() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) {
    const { redirect } = await import('next/navigation')
    redirect('/login')
  }
  return session!
}

export async function getUserWithGoals(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    include: { profile: true, goals: true },
  })
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
