import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility for merging Tailwind classes without conflicts.
 * Re-exported from packages/ui so all apps use the same instance.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
