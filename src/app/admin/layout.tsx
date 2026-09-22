import Sidebar from '@/components/Sidebar'
import { requireAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const admin = await requireAdmin()
  if (!admin) {
    redirect('/?reason=admin_required')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />
      <div className="flex-1 dsm-page-with-sidebar flex flex-col min-w-0">
        {children}
      </div>
    </div>
  )
}
