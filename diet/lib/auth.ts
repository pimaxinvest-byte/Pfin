import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'crypto'
import { db } from './db'

const SESSION_COOKIE = 'diet_session'
const MAX_AGE = 60 * 60 * 24 * 30

export type Role = 'TRAINER' | 'USER'

export type SessionUser = {
  id: string
  email: string
  name: string
  role: Role
}

// Trainer accounts are identified by email. Override with the TRAINER_EMAILS
// env var (comma-separated). Falls back to the coach + demo accounts so the
// app works out of the box. Everyone else is a regular client.
function trainerEmails(): string[] {
  const env = process.env.TRAINER_EMAILS
  const list = env ? env.split(',') : ['demo@daddystrainer.com', 'pimaxinvest@gmail.com']
  return list.map((e) => e.trim().toLowerCase()).filter(Boolean)
}

export function roleForEmail(email: string): Role {
  return trainerEmails().includes(email.toLowerCase()) ? 'TRAINER' : 'USER'
}

// SESSION_SECRET must be set in production. In dev we fall back to a fixed
// value so local sessions keep working, but signing is always enforced.
// Resolved lazily (not at module load) so `next build` doesn't crash when the
// env var is only present at runtime.
function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET environment variable is required in production')
  }
  return 'dev-insecure-secret-change-me'
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

function verify(payload: string, signature: string): boolean {
  const expected = sign(payload)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies()
  const raw = store.get(SESSION_COOKIE)?.value
  if (!raw) return null
  const dot = raw.lastIndexOf('.')
  if (dot < 0) return null
  const payload = raw.slice(0, dot)
  const signature = raw.slice(dot + 1)
  if (!verify(payload, signature)) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionUser
    // Backfill role for sessions issued before roles existed.
    if (!parsed.role) parsed.role = roleForEmail(parsed.email)
    return parsed
  } catch {
    return null
  }
}

export async function createSession(user: SessionUser) {
  const store = await cookies()
  const payload = Buffer.from(JSON.stringify(user)).toString('base64url')
  const value = `${payload}.${sign(payload)}`
  store.set(SESSION_COOKIE, value, {
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

export async function requireTrainer(): Promise<SessionUser> {
  const session = await requireAuth()
  if (session.role !== 'TRAINER') {
    const { redirect } = await import('next/navigation')
    redirect('/dashboard')
  }
  return session
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
