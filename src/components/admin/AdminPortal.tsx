import { useEffect, useState } from 'react'
import { ClientProfile, User } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .ilike('role', 'client')
      .order('name', { ascending: true })
      .then(({ data }) => {
        const nextClients = (data as ClientProfile[]) ?? []
        setClients(nextClients)
        setSelectedClientId((current) => current || nextClients[0]?.id || '')
      })
  }, [])

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null

  const handleLogout = async () => {
    await supabase.auth.signOut()
    onLogout()
  }

  const navItems = [
    { id: 'dashboard' as AdminTab, label: 'Dashboard',    icon: LayoutDashboard },
    { id: 'clients'   as AdminTab, label: 'Clients',      icon: Users },
    { id: 'schedule'  as AdminTab, label: 'Create Post',  icon: CalendarPlus },
    { id: 'approvals' as AdminTab, label: 'Approvals',    icon: CheckSquare },
    { id: 'metrics'   as AdminTab, label: 'Metrics',      icon: BarChart2 },
    { id: 'requests'  as AdminTab, label: 'Requests',     icon: MessageSquare },
  ]

  return (
    <div className="min-h-screen bg-background flex">
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

      <main className="flex-1 ml-64 p-8 overflow-y-auto space-y-6">
        <div className="rounded-xl border border-border/50 bg-card/50 p-4 md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Client Workspace</h2>
              <p className="text-sm text-muted-foreground">
                Switch clients here and keep the rest of the portal focused on one account at a time.
              </p>
            </div>

            <div className="w-full md:max-w-sm space-y-2">
              <Label htmlFor="admin-client-switcher">Viewing client</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId} disabled={clients.length === 0}>
                <SelectTrigger id="admin-client-switcher">
                  <SelectValue placeholder={clients.length === 0 ? 'No clients available' : 'Select a client'} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedClient && (
            <p className="mt-3 text-sm text-muted-foreground">
              Currently focused on <span className="font-medium text-foreground">{selectedClient.name}</span>.
            </p>
          )}
        </div>

        {activeTab === 'dashboard' && (
          <AdminDashboard selectedClientId={selectedClientId} selectedClientName={selectedClient?.name} />
        )}
        {activeTab === 'clients'   && <ClientList />}
        {activeTab === 'schedule'  && (
          <PostScheduler selectedClientId={selectedClientId} selectedClientName={selectedClient?.name} />
        )}
        {activeTab === 'approvals' && (
          <ApprovalManager selectedClientId={selectedClientId} selectedClientName={selectedClient?.name} />
        )}
        {activeTab === 'metrics'   && (
          <MetricsEntry selectedClientId={selectedClientId} selectedClientName={selectedClient?.name} />
        )}
        {activeTab === 'requests'  && (
          <RequestManager selectedClientId={selectedClientId} selectedClientName={selectedClient?.name} />
        )}
      </main>
    </div>
  )
}