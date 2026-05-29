import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { BottomNav } from '@/components/layout/BottomNav'
import { Header } from '@/components/layout/Header'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.user || session.user.role !== 'admin') redirect('/login')

  return (
    <div className="page-container">
      <Header title="🏋️ GymBook Admin" showLogout />
      <main className="px-4 py-4">{children}</main>
      <BottomNav role="admin" />
    </div>
  )
}
