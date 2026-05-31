import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { AuthForm } from '@/components/AuthForm'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const user = await getSessionUser()
  if (user?.role === 'admin') redirect('/admin')
  if (user?.role === 'teacher') redirect('/teacher')
  if (user?.role === 'client') redirect('/client')

  return (
    <main className="auth-wrap">
      <AuthForm mode="login" />
    </main>
  )
}
