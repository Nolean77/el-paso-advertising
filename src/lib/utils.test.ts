import { describe, expect, it } from 'vitest'

import {
  buildApprovalImagePlaceholder,
  encodeApprovalCaption,
  findRelevantMetricForScheduledPost,
  parseApprovalCaption,
  resolveUserRole,
} from './utils'
import type { PerformanceMetric, ScheduledPost } from './types'

describe('resolveUserRole', () => {
  it('treats admin role values case-insensitively', () => {
    expect(resolveUserRole('ADMIN')).toBe('admin')
    expect(resolveUserRole(' Admin ')).toBe('admin')
    expect(resolveUserRole(undefined, 'admin')).toBe('admin')
  })

  it('falls back to client for unknown or missing roles', () => {
    expect(resolveUserRole('manager')).toBe('client')
    expect(resolveUserRole()).toBe('client')
  })
})

describe('approval caption helpers', () => {
  it('round-trips captions and metadata', () => {
    const encoded = encodeApprovalCaption('Launch campaign update', {
      requestedBy: 'client',
      requestedDate: '2026-04-06',
      sourceRequestId: 'req-123',
      title: 'Launch campaign update',
    })

    expect(encoded).toContain('[[EPA_META:')

    const parsed = parseApprovalCaption(encoded)

    expect(parsed.caption).toBe('Launch campaign update')
    expect(parsed.meta).toMatchObject({
      requestedBy: 'client',
      requestedDate: '2026-04-06',
      sourceRequestId: 'req-123',
    })
  })

  it('returns the original caption when metadata is invalid', () => {
    const parsed = parseApprovalCaption('[[EPA_META:not-valid]]\nVisible caption')

    expect(parsed.caption).toBe('Visible caption')
    expect(parsed.meta).toEqual({})
  })

  it('does not show metrics for posts that have not been published yet', () => {
    const post: ScheduledPost = {
      id: 'post-1',
      user_id: 'user-1',
      date: '2026-04-06',
      platform: 'facebook',
      caption: 'Spring sale starts Friday',
      image_url: 'https://example.com/post.jpg',
      status: 'scheduled',
      posted_to_facebook: false,
      posted_to_instagram: false,
      posted_at: null,
    }

    const metrics: PerformanceMetric[] = [{
      id: 'metric-1',
      user_id: 'user-1',
      caption: 'Spring sale starts Friday',
      date: '2026-04-06',
      platform: 'facebook',
      reach: 1200,
      likes: 85,
      engagement_rate: 7.1,
    }]

    expect(findRelevantMetricForScheduledPost(post, metrics)).toBeNull()
  })

  it('matches only the relevant published post metric', () => {
    const post: ScheduledPost = {
      id: 'post-2',
      user_id: 'user-1',
      date: '2026-04-06',
      platform: 'facebook',
      caption: 'Spring sale starts Friday',
      image_url: 'https://example.com/post.jpg',
      status: 'scheduled',
      posted_to_facebook: true,
      posted_to_instagram: false,
      posted_at: '2026-04-06T15:30:00.000Z',
      facebook_post_id: 'fb-post-123',
    }

    const unrelatedMetric: PerformanceMetric = {
      id: 'metric-unrelated',
      user_id: 'user-1',
      caption: 'Different community event update',
      date: '2026-04-06',
      platform: 'facebook',
      reach: 990,
      likes: 41,
      engagement_rate: 4.1,
    }

    const matchingMetric: PerformanceMetric = {
      id: 'metric-match',
      user_id: 'user-1',
      caption: 'Spring sale starts Friday',
      date: '2026-04-06',
      platform: 'facebook',
      reach: 5400,
      likes: 310,
      engagement_rate: 9.4,
    }

    expect(findRelevantMetricForScheduledPost(post, [unrelatedMetric])).toBeNull()
    expect(findRelevantMetricForScheduledPost(post, [unrelatedMetric, matchingMetric])?.id).toBe('metric-match')
  })

  it('builds a safe SVG placeholder', () => {
    const placeholder = buildApprovalImagePlaceholder('Spring <Sale> & More')
    const decodedPlaceholder = decodeURIComponent(placeholder)

    expect(placeholder.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    expect(decodedPlaceholder).toContain('Spring &lt;Sale&gt; &amp; More')
  })
})
