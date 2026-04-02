import { useEffect, useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { SignOut, CalendarBlank, CheckSquare, ChartBar, Article } from '@phosphor-icons/react'
import { toast } from 'sonner'
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
import { buildApprovalImagePlaceholder, encodeApprovalCaption, parseApprovalCaption, resolveUserRole } from '@/lib/utils'
import type { User, ScheduledPost, ApprovalPost, PerformanceMetric, ContentRequest, RequestSubmission } from '@/lib/types'

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
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            console.log('RAW PROFILE FROM DB:', profile)
            console.log('ROLE VALUE:', profile?.role)
            setUser({
              id: session.user.id,
              email: session.user.email!,
              name: profile?.name || session.user.email?.split('@')[0] || 'User',
              role: resolveUserRole(profile?.role, session.user.user_metadata?.role, session.user.app_metadata?.role),
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
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            console.log('RAW PROFILE FROM DB:', profile)
            console.log('ROLE VALUE:', profile?.role)
            setUser({
              id: session.user.id,
              email: session.user.email!,
              name: profile?.name || session.user.email?.split('@')[0] || 'User',
              role: resolveUserRole(profile?.role, session.user.user_metadata?.role, session.user.app_metadata?.role),
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

  const syncRequestStatusFromApproval = async (post: ApprovalPost, approvalStatus: ApprovalPost['status']) => {
    const { meta } = parseApprovalCaption(post.caption)
    if (!meta.sourceRequestId) return

    const nextStatus = approvalStatus === 'approved' ? 'completed' : 'inProgress'
    const { error } = await supabase
      .from('content_requests')
      .update({ status: nextStatus })
      .eq('id', meta.sourceRequestId)
      .eq('user_id', post.user_id)

    if (!error) {
      setContentRequests((currentRequests) =>
        currentRequests.map((request) =>
          request.id === meta.sourceRequestId
            ? { ...request, status: nextStatus }
            : request
        )
      )
    }
  }

  const addApprovedPostToCalendar = async (post: ApprovalPost) => {
    const { caption, meta } = parseApprovalCaption(post.caption)
    const scheduledDate = meta.requestedDate || new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('scheduled_posts')
      .insert([{
        user_id: post.user_id,
        date: scheduledDate,
        platform: post.platform,
        caption,
        image_url: post.image_url || buildApprovalImagePlaceholder(meta.title || caption),
        status: 'scheduled',
      }])
      .select()
      .single()

    if (error) {
      toast.error(currentLanguage === 'en'
        ? 'The item was approved, but it could not be added to the content calendar.'
        : 'El elemento fue aprobado, pero no se pudo agregar al calendario de contenido.')
      return
    }

    if (data) {
      setScheduledPosts((currentPosts) =>
        [...currentPosts, data as ScheduledPost].sort((a, b) => a.date.localeCompare(b.date))
      )
    }
  }

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

    const targetPost = approvalPosts.find((post) => post.id === postId)
    if (!targetPost) return

    const { error } = await supabase
      .from('approval_posts')
      .update({ status, feedback: feedback || null })
      .eq('id', postId)
      .eq('user_id', user.id)

    if (error) {
      toast.error(currentLanguage === 'en' ? 'Unable to update approval status.' : 'No se pudo actualizar el estado de aprobación.')
      return
    }

    setApprovalPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === postId
          ? { ...post, status, feedback: feedback || post.feedback }
          : post
      )
    )

    await syncRequestStatusFromApproval(targetPost, status)

    if (status === 'approved') {
      await addApprovedPostToCalendar(targetPost)
    }
  }

  const handleSubmitRequest = async (request: RequestSubmission) => {
    if (!user) return

    const { platform, requested_date, ...requestDetails } = request
    const newRequest = {
      ...requestDetails,
      user_id: user.id,
      status: 'pending' as const,
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('content_requests')
      .insert([newRequest])
      .select()
      .single()

    if (error || !data) {
      toast.error(currentLanguage === 'en' ? 'Unable to submit your request right now.' : 'No se pudo enviar tu solicitud en este momento.')
      return
    }

    setContentRequests((current) => [data as ContentRequest, ...current])

    const approvalCaption = encodeApprovalCaption(
      `${request.title}\n\n${request.description}`,
      {
        requestedBy: 'client',
        requestedDate: requested_date,
        sourceRequestId: data.id,
        title: request.title,
      }
    )

    const { data: approvalData, error: approvalError } = await supabase
      .from('approval_posts')
      .insert([{
        user_id: user.id,
        caption: approvalCaption,
        image_url: request.reference_images?.[0] || buildApprovalImagePlaceholder(request.title),
        platform,
        status: 'pending',
      }])
      .select()
      .single()

    if (approvalError) {
      toast.error(currentLanguage === 'en'
        ? 'Your request was saved, but it could not be routed to approvals.'
        : 'Tu solicitud se guardó, pero no pudo enviarse a aprobaciones.')
      return
    }

    if (approvalData) {
      setApprovalPosts((current) => [approvalData as ApprovalPost, ...current])
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