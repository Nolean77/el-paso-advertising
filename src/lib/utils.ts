import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function resolveUserRole(...values: unknown[]): 'admin' | 'client' {
  for (const value of values) {
    if (typeof value !== 'string') continue

    const normalized = value.trim().toLowerCase()
    if (normalized === 'admin') return 'admin'
    if (normalized === 'client') return 'client'
  }

  return 'client'
}
