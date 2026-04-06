import { describe, expect, it } from 'vitest'

import {
  buildApprovalImagePlaceholder,
  encodeApprovalCaption,
  parseApprovalCaption,
  resolveUserRole,
} from './utils'

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

  it('builds a safe SVG placeholder', () => {
    const placeholder = buildApprovalImagePlaceholder('Spring <Sale> & More')
    const decodedPlaceholder = decodeURIComponent(placeholder)

    expect(placeholder.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    expect(decodedPlaceholder).toContain('Spring &lt;Sale&gt; &amp; More')
  })
})
