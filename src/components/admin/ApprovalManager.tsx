import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ClientProfile, ApprovalPost } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export function ApprovalManager() {
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [posts, setPosts] = useState<ApprovalPost[]>([])
  const [clientId, setClientId] = useState('')
  const [platform, setPlatform] = useState('')
  const [caption, setCaption] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('*').ilike('role', 'client')
      .then(({ data }) => setClients((data as ClientProfile[]) ?? []))

    supabase.from('approval_posts').select('*').eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then(({ data }) => setPosts((data as ApprovalPost[]) ?? []))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !platform || !caption || !imageUrl) {
      toast.error('Please fill in all fields')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('approval_posts').insert({
      user_id: clientId,
      platform,
      caption,
      image_url: imageUrl,
      status: 'pending',
    })
    setSaving(false)
    if (error) {
      toast.error('Failed: ' + error.message)
    } else {
      toast.success('Post added for approval!')
      setCaption('')
      setImageUrl('')
    }
  }

  const statusColor = (status: string) => {
    if (status === 'approved') return 'bg-green-500/20 text-green-500'
    if (status === 'changes-requested') return 'bg-yellow-500/20 text-yellow-500'
    return 'bg-blue-500/20 text-blue-500'
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <h2 className="text-2xl font-bold">Approval Manager</h2>

      <Card>
        <CardHeader><CardTitle>Add Post for Approval</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Platform</Label>
              <Select onValueChange={setPlatform}>
                <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="twitter">Twitter</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Caption</Label>
              <Textarea value={caption} onChange={e => setCaption(e.target.value)} rows={3} />
            </div>

            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." />
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? 'Adding...' : 'Add for Approval'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="font-semibold text-lg">Pending Approvals ({posts.length})</h3>
        {posts.map(post => (
          <Card key={post.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Badge className={statusColor(post.status)}>{post.status}</Badge>
                <span className="text-xs text-muted-foreground capitalize">{post.platform}</span>
              </div>
              <p className="text-sm">{post.caption}</p>
              {post.feedback && (
                <p className="text-xs text-muted-foreground italic">Feedback: {post.feedback}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}