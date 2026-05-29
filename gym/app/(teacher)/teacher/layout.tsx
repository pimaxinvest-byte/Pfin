import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { BottomNav } from '@/components/layout/BottomNav'
import { Header } from '@/components/layout/Header'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.user || !['admin', 'teacher'].includes(session.user.role)) redirect('/login')

  return (
    <div className="page">
      <Header showLogo showLogout subtitle="Profesor" />
      <main className="page-content">{children}</main>
      <BottomNav role="teacher" />
    </div>
  )
}
