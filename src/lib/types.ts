export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'client'
}

export interface ScheduledPost {
  id: string
  user_id: string
  date: string
  platform: 'instagram' | 'facebook' | 'twitter' | 'linkedin'
  caption: string
  image_url: string
  status: 'scheduled' | 'removed'
}

export interface ApprovalPost {
  id: string
  user_id: string
  caption: string
  image_url: string
  platform: 'instagram' | 'facebook' | 'twitter' | 'linkedin'
  status: 'pending' | 'approved' | 'changes-requested'
  feedback?: string
  created_at?: string
}

export interface ApprovalWorkflowMeta {
  requestedBy?: 'admin' | 'client'
  requestedDate?: string
  sourceRequestId?: string
  sourceScheduledPostId?: string
  changeType?: 'revision' | 'removed'
  title?: string
}

export interface PerformanceMetric {
  id: string
  user_id: string
  caption: string
  date: string
  platform: 'instagram' | 'facebook' | 'twitter' | 'linkedin'
  reach: number
  likes: number
  engagement_rate: number
}

export interface ContentRequest {
  id: string
  user_id: string
  title: string
  description: string
  type: 'content' | 'design' | 'campaign' | 'other'
  status: 'pending' | 'inProgress' | 'completed'
  created_at: string
  reference_images?: string[]
}

export interface RequestSubmission extends Omit<ContentRequest, 'id' | 'user_id' | 'created_at' | 'status'> {
  platform: ApprovalPost['platform']
  requested_date?: string
}

export interface ClientProfile {
  id: string
  name: string
  email?: string
  role: 'admin' | 'client'
  created_at: string
}