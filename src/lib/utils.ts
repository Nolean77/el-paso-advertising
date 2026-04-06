import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { ApprovalWorkflowMeta } from "./types"

const APPROVAL_META_PREFIX = '[[EPA_META:'
const APPROVAL_META_SUFFIX = ']]'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function normalizeRoleValue(...roles: Array<string | null | undefined>) {
  return roles
    .map((role) => role?.trim().toLowerCase())
    .find((role): role is string => Boolean(role))
}

export function resolveUserRole(
  profileRole?: string | null,
  userMetaRole?: string | null,
  appMetaRole?: string | null
): 'admin' | 'client' {
  return normalizeRoleValue(profileRole, userMetaRole, appMetaRole) === 'admin'
    ? 'admin'
    : 'client'
}

export function encodeApprovalCaption(caption: string, meta: ApprovalWorkflowMeta = {}) {
  const cleanedCaption = caption.trim()
  const hasMeta = Object.values(meta).some((value) => Boolean(value))

  if (!hasMeta) {
    return cleanedCaption
  }

  const encodedMeta = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(meta))))
  return `${APPROVAL_META_PREFIX}${encodedMeta}${APPROVAL_META_SUFFIX}\n${cleanedCaption}`
}

export function parseApprovalCaption(rawCaption: string) {
  if (!rawCaption.startsWith(APPROVAL_META_PREFIX)) {
    return { caption: rawCaption, meta: {} as ApprovalWorkflowMeta }
  }

  const suffixIndex = rawCaption.indexOf(APPROVAL_META_SUFFIX)
  if (suffixIndex === -1) {
    return { caption: rawCaption, meta: {} as ApprovalWorkflowMeta }
  }

  const encodedMeta = rawCaption.slice(APPROVAL_META_PREFIX.length, suffixIndex)
  const visibleCaption = rawCaption.slice(suffixIndex + APPROVAL_META_SUFFIX.length).trim()

  try {
    const decoded = atob(encodedMeta)
    const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0))
    const meta = JSON.parse(new TextDecoder().decode(bytes)) as ApprovalWorkflowMeta
    return { caption: visibleCaption || rawCaption, meta }
  } catch {
    return { caption: visibleCaption || rawCaption, meta: {} as ApprovalWorkflowMeta }
  }
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildApprovalImagePlaceholder(title: string) {
  const safeTitle = escapeSvgText(title.trim() || 'Content Request')
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#1f2937" />
          <stop offset="100%" stop-color="#f59e0b" />
        </linearGradient>
      </defs>
      <rect width="1200" height="1200" fill="url(#bg)" rx="48" />
      <text x="50%" y="48%" text-anchor="middle" font-size="68" font-family="Arial, sans-serif" fill="#ffffff" font-weight="700">
        Approval Request
      </text>
      <text x="50%" y="57%" text-anchor="middle" font-size="40" font-family="Arial, sans-serif" fill="#fef3c7">
        ${safeTitle.slice(0, 48)}
      </text>
    </svg>
  `

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
