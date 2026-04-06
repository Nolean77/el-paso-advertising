import { describe, expect, it } from 'vitest'

import {
  buildApprovalImagePlaceholder,
  encodeApprovalCaption,
  findRelevantMetricForScheduledPost,
  normalizePerformanceMetrics,
  parseApprovalCaption,
  resolveUserRole,
  shouldRetryMetricSync,
  sortPerformanceMetricsForTimeline,
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

  it('matches pulled Facebook metrics for cross-posted portal content', () => {
    const post: ScheduledPost = {
      id: 'post-3',
      user_id: 'user-1',
      date: '2026-04-07',
      platform: 'instagram',
      caption: 'Behind the scenes at our spring launch',
      image_url: 'https://example.com/post-3.jpg',
      status: 'scheduled',
      posted_to_facebook: true,
      posted_to_instagram: true,
      posted_at: '2026-04-07T18:00:00.000Z',
      facebook_post_id: 'fb-post-456',
      instagram_post_id: 'ig-post-456',
    }

    const pulledFacebookMetric: PerformanceMetric = {
      id: 'metric-facebook-cross-post',
      user_id: 'user-1',
      caption: 'Behind the scenes at our spring launch',
      date: '2026-04-07',
      platform: 'facebook',
      reach: 3200,
      likes: 180,
      engagement_rate: 5.6,
    }

    expect(findRelevantMetricForScheduledPost(post, [pulledFacebookMetric])?.id).toBe('metric-facebook-cross-post')
  })

  it('normalizes engagement values returned as strings', () => {
    const [metric] = normalizePerformanceMetrics([{
      id: 'metric-string-values',
      user_id: 'user-1',
      caption: 'Spring sale starts Friday',
      date: '2026-04-06',
      platform: 'facebook',
      reach: '1200' as unknown as number,
      likes: '85' as unknown as number,
      engagement_rate: '7.25' as unknown as number,
    }])

    expect(metric.reach).toBe(1200)
    expect(metric.likes).toBe(85)
    expect(metric.engagement_rate).toBe(7.25)
  })

  it('sorts performance metrics into chronological timeline order', () => {
    const ordered = sortPerformanceMetricsForTimeline([
      {
        id: 'metric-2',
        user_id: 'user-1',
        caption: 'Second post',
        date: '2026-04-07',
        created_at: '2026-04-07T10:00:00.000Z',
        platform: 'facebook',
        reach: 800,
        likes: 30,
        engagement_rate: 3.8,
      },
      {
        id: 'metric-1',
        user_id: 'user-1',
        caption: 'First post',
        date: '2026-04-06',
        created_at: '2026-04-06T09:00:00.000Z',
        platform: 'facebook',
        reach: 600,
        likes: 20,
        engagement_rate: 3.2,
      },
      {
        id: 'metric-3',
        user_id: 'user-1',
        caption: 'Third post',
        date: '2026-04-07',
        created_at: '2026-04-07T11:00:00.000Z',
        platform: 'facebook',
        reach: 900,
        likes: 40,
        engagement_rate: 4.4,
      },
    ])

    expect(ordered.map((metric) => metric.id)).toEqual(['metric-1', 'metric-2', 'metric-3'])
  })

  it('retries sync when a recent published post still has incomplete engagement data', () => {
    const post: ScheduledPost = {
      id: 'post-retry',
      user_id: 'user-1',
      date: '2026-04-06',
      platform: 'facebook',
      caption: 'Grand opening this weekend',
      image_url: 'https://example.com/post-retry.jpg',
      status: 'scheduled',
      posted_to_facebook: true,
      posted_to_instagram: false,
      posted_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      facebook_post_id: 'fb-post-retry',
    }

    const incompleteMetric: PerformanceMetric = {
      id: 'metric-retry',
      user_id: 'user-1',
      caption: 'Grand opening this weekend',
      date: '2026-04-06',
      platform: 'facebook',
      reach: 1200,
      likes: 35,
      engagement_rate: 0,
    }

    expect(shouldRetryMetricSync(post, [incompleteMetric])).toBe(true)
  })

  it('builds a safe SVG placeholder', () => {
    const placeholder = buildApprovalImagePlaceholder('Spring <Sale> & More')
    const decodedPlaceholder = decodeURIComponent(placeholder)

    expect(placeholder.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    expect(decodedPlaceholder).toContain('Spring &lt;Sale&gt; &amp; More')
  })
})
