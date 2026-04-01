export interface User {
  email: string
  name: string
}

export interface ScheduledPost {
  id: string
  date: string
  platform: 'instagram' | 'facebook' | 'twitter' | 'linkedin'
  caption: string
  imageUrl: string
  status: 'scheduled'
}

export interface ApprovalPost {
  id: string
  caption: string
  imageUrl: string
  platform: 'instagram' | 'facebook' | 'twitter' | 'linkedin'
  status: 'pending' | 'approved' | 'changes-requested'
  feedback?: string
}

export interface PerformanceMetric {
  id: string
  caption: string
  date: string
  platform: 'instagram' | 'facebook' | 'twitter' | 'linkedin'
  reach: number
  likes: number
  engagementRate: number
}

export interface ContentRequest {
  id: string
  title: string
  description: string
  type: 'content' | 'design' | 'campaign' | 'other'
  status: 'pending' | 'inProgress' | 'completed'
  createdAt: string
  referenceImages?: string[]
}
