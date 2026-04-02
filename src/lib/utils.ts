import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function resolveUserRole(
  profileRole?: string | null,
  userMetaRole?: string | null,
  appMetaRole?: string | null
): 'admin' | 'client' {
  const role = profileRole ?? userMetaRole ?? appMetaRole ?? 'client'
  if (role === 'admin') return 'admin'
  return 'client'
}
