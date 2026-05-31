import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AuthForm } from '@/components/AuthForm'

export const dynamic = 'force-dynamic'

export default async function RegisterPage() {
  const count = await prisma.user.count()
  if (count > 0) redirect('/login')

  return (
    <main className="auth-wrap">
      <AuthForm mode="setup" />
    </main>
  )
}
