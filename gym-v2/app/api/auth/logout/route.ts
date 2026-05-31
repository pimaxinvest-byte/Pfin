import { NextResponse } from 'next/server'
import { clearSession } from '@/lib/auth'

export function POST() {
  clearSession()
  return NextResponse.json({ ok: true })
}
