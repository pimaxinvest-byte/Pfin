import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { BottomNav } from '@/components/layout/BottomNav'
import { Header } from '@/components/layout/Header'

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.user) redirect('/login')

  return (
    <div className="page-container">
      <Header title="🏋️ GymBook" showLogout />
      <main className="px-4 py-4">{children}</main>
      <BottomNav role="client" />
    </div>
  )
}
