import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const count = await prisma.user.count()
  if (count === 0) redirect('/register')

  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (user.role === 'admin') redirect('/admin')
  if (user.role === 'teacher') redirect('/teacher')
  redirect('/client')
}
