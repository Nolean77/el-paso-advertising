import { useState } from 'react'
import { User } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import {
  Users, CalendarPlus, CheckSquare,
  BarChart2, MessageSquare, LayoutDashboard, LogOut
} from 'lucide-react'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { ClientList } from '@/components/admin/ClientList'
import { PostScheduler } from '@/components/admin/PostScheduler'
import { ApprovalManager } from '@/components/admin/ApprovalManager'
import { MetricsEntry } from '@/components/admin/MetricsEntry'
import { RequestManager } from '@/components/admin/RequestManager'

type AdminTab = 'dashboard' | 'clients' | 'schedule' | 'approvals' | 'metrics' | 'requests'

interface AdminPortalProps {
  user: User
  onLogout: () => void
}

export function AdminPortal({ user, onLogout }: AdminPortalProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    onLogout()
  }

  const navItems = [
    { id: 'dashboard' as AdminTab, label: 'Dashboard',    icon: LayoutDashboard },
    { id: 'clients'   as AdminTab, label: 'Clients',      icon: Users },
    { id: 'schedule'  as AdminTab, label: 'Schedule Post', icon: CalendarPlus },
    { id: 'approvals' as AdminTab, label: 'Approvals',    icon: CheckSquare },
    { id: 'metrics'   as AdminTab, label: 'Metrics',      icon: BarChart2 },
    { id: 'requests'  as AdminTab, label: 'Requests',     icon: MessageSquare },
  ]

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border/50 bg-card/50 flex flex-col fixed h-full z-40">
        <div className="p-6 border-b border-border/50">
          <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-yellow-300 bg-clip-text text-transparent">
            EP Admin
          </h1>
          <p className="text-xs text-muted-foreground mt-1">{user.name}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                activeTab === id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start gap-2 text-muted-foreground"
          >
            <LogOut size={16} />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        {activeTab === 'dashboard' && <AdminDashboard />}
        {activeTab === 'clients'   && <ClientList />}
        {activeTab === 'schedule'  && <PostScheduler />}
        {activeTab === 'approvals' && <ApprovalManager />}
        {activeTab === 'metrics'   && <MetricsEntry />}
        {activeTab === 'requests'  && <RequestManager />}
      </main>
    </div>
  )
}