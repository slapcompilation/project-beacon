// Platform branding, resolved by one call: title, logos through the published
// fallback table, and the enabled banner. The server side is 649.
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth.store'

export interface PlatformBanner {
  enabled: boolean
  text: string
  text_color: string
  banner_color: string
  position: 'top' | 'bottom' | 'top_and_bottom'
  show_when_printing: boolean
  show_with_classification_banner: boolean
}

// The viewer's classification banner, composed server-side from their
// CBAC-configured marking memberships (674/675). Null when none.
export interface CbacBanner {
  classification_string: string
  markings: string[]
  text_color: string
  background_colors: string[]
}

export interface PlatformExperience {
  title: string
  logos: Partial<Record<'favicon' | 'small' | 'medium' | 'large', string>> | null
  banner: PlatformBanner | null
  cbac: CbacBanner | null
}

export function usePlatformExperience() {
  const orgId = useAuthStore((s) => s.organizationId)
  return useQuery({
    queryKey: ['platform-experience', orgId],
    enabled: orgId !== null,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PlatformExperience> => {
      const res = (await supabase.rpc('platform_experience', { p_org: orgId })) as {
        data: PlatformExperience | null
        error: { message: string } | null
      }
      if (res.error) throw new Error(res.error.message)
      if (res.data === null) throw new Error('platform_experience returned nothing')
      return res.data
    },
  })
}

// "The default home page when users open Foundry" — the configured home URL,
// per user: the first group override that matches, else the org default,
// else null and the shell keeps its own home.
export function useHomePageUrl() {
  const orgId = useAuthStore((s) => s.organizationId)
  return useQuery({
    queryKey: ['home-page-url', orgId],
    enabled: orgId !== null,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const res = (await supabase.rpc('home_page_url')) as {
        data: string | null
        error: { message: string } | null
      }
      if (res.error) throw new Error(res.error.message)
      return res.data
    },
  })
}

// "The Banner text field supports basic Markdown syntax" — links are the use
// the capture names, so links are what renders; everything else stays text.
export function BannerText({ text }: { text: string }) {
  const parts: ReactNode[] = []
  const link = /\[([^\]]+)\]\(([^)]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = link.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push(<a key={key++} href={m[2]} target="_blank" rel="noreferrer">{m[1]}</a>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}
