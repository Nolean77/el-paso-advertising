import { useEffect, useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { SignOut, CalendarBlank, CheckSquare, ChartBar, Article } from '@phosphor-icons/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { LoginPage } from '@/components/LoginPage'
import { LanguageToggle } from '@/components/LanguageToggle'
import { ContentCalendar } from '@/components/ContentCalendar'
import { Approvals } from '@/components/Approvals'
import { Performance } from '@/components/Performance'
import { Requests } from '@/components/Requests'
import { AdminPortal } from '@/components/admin/AdminPortal'
import { supabase } from '@/lib/supabase'
import type { Language } from '@/lib/translations'
import { translations } from '@/lib/translations'
import type { User, ScheduledPost, ApprovalPost, PerformanceMetric, ContentRequest } from '@/lib/types'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [language, setLanguage] = useKV<Language>('language', 'en')
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
  const [approvalPosts, setApprovalPosts] = useState<ApprovalPost[]>([])
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([])
  const [contentRequests, setContentRequests] = useState<ContentRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase
          .from('profiles')
          .select('name, role')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            setUser({
              id: session.user.id,
              email: session.user.email!,
              name: profile?.name || session.user.email?.split('@')[0] || 'User',
              role: profile?.role || 'client',
            })
          })
      }
      setIsLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        supabase
          .from('profiles')
          .select('name, role')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            setUser({
              id: session.user.id,
              email: session.user.email!,
              name: profile?.name || session.user.email?.split('@')[0] || 'User',
              role: profile?.role || 'client',
            })
          })
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return

    const loadData = async () => {
      const [scheduledRes, approvalsRes, metricsRes, requestsRes] = await Promise.all([
        supabase.from('scheduled_posts').select('*').eq('user_id', user.id).order('date', { ascending: true }),
        supabase.from('approval_posts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('performance_metrics').select('*').eq('user_id', user.id).order('date', { ascending: false }),
        supabase.from('content_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ])

      if (scheduledRes.data) setScheduledPosts(scheduledRes.data as ScheduledPost[])
      if (approvalsRes.data) setApprovalPosts(approvalsRes.data as ApprovalPost[])
      if (metricsRes.data) setPerformanceMetrics(metricsRes.data as PerformanceMetric[])
      if (requestsRes.data) setContentRequests(requestsRes.data as ContentRequest[])
    }

    loadData()
  }, [user])

  const currentLanguage = language || 'en'
  const t = translations[currentLanguage].nav

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const toggleLanguage = () => {
    setLanguage((current) => (current || 'en') === 'en' ? 'es' : 'en')
  }

  const handleUpdatePost = async (postId: string, status: ApprovalPost['status'], feedback?: string) => {
    if (!user) return

    const { error } = await supabase
      .from('approval_posts')
      .update({ status, feedback: feedback || null })
      .eq('id', postId)
      .eq('user_id', user.id)

    if (!error) {
      setApprovalPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId
            ? { ...post, status, feedback: feedback || post.feedback }
            : post
        )
      )
    }
  }

  const handleSubmitRequest = async (request: Omit<ContentRequest, 'id' | 'user_id' | 'created_at' | 'status'>) => {
    if (!user) return

    const newRequest = {
      ...request,
      user_id: user.id,
      status: 'pending' as const,
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('content_requests')
      .insert([newRequest])
      .select()
      .single()

    if (!error && data) {
      setContentRequests((current) => [data as ContentRequest, ...current])
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <>
        <LoginPage onLogin={handleLogin} language={currentLanguage} onLanguageToggle={toggleLanguage} />
        <Toaster />
      </>
    )
  }

  if (user.role === 'admin') {
    return (
      <>
        <AdminPortal user={user} onLogout={handleLogout} />
        <Toaster />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.15),transparent_50%)]" />
      
      <div className="relative">
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 md:px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-yellow-300 bg-clip-text text-transparent">
                  El Paso Advertising
                </h1>
                <p className="text-sm text-muted-foreground">
                  {currentLanguage === 'en' ? `Welcome, ${user.name}` : `Bienvenido, ${user.name}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <LanguageToggle language={currentLanguage} onToggle={toggleLanguage} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="gap-2"
                >
                  <SignOut size={18} weight="bold" />
                  <span className="hidden sm:inline">{t.logout}</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 md:px-6 py-8">
          <Tabs defaultValue="calendar" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto gap-2 bg-card/50 p-2">
              <TabsTrigger 
                value="calendar" 
                className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <CalendarBlank size={18} weight="bold" />
                <span className="hidden sm:inline">{t.calendar}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="approvals"
                className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <CheckSquare size={18} weight="bold" />
                <span className="hidden sm:inline">{t.approvals}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="performance"
                className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <ChartBar size={18} weight="bold" />
                <span className="hidden sm:inline">{t.performance}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="requests"
                className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Article size={18} weight="bold" />
                <span className="hidden sm:inline">{t.requests}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="calendar" className="space-y-4">
              <ContentCalendar posts={scheduledPosts || []} language={currentLanguage} />
            </TabsContent>

            <TabsContent value="approvals" className="space-y-4">
              <Approvals 
                posts={approvalPosts || []} 
                onUpdatePost={handleUpdatePost}
                language={currentLanguage}
              />
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <Performance metrics={performanceMetrics || []} language={currentLanguage} />
            </TabsContent>

            <TabsContent value="requests" className="space-y-4">
              <Requests 
                requests={contentRequests || []}
                onSubmitRequest={handleSubmitRequest}
                language={currentLanguage}
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <Toaster />
    </div>
  )
}

export default App