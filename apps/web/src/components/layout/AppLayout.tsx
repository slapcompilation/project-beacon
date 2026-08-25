import { useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { PlatformSidebar } from '@/features/platformShell/PlatformSidebar'
import { titleForPath } from '@/features/platformShell/apps'
import { usePlatformExperience, useHomePageUrl, BannerText } from '@/features/platformShell/branding'
import { ServiceWorkerUpdatePrompt } from '@/components/ServiceWorkerUpdatePrompt'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import { useAppStore } from '@/stores/app.store'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const pushRecent = useAppStore((s) => s.pushRecent)
  const { data: branding } = usePlatformExperience()
  const { data: homeUrl } = useHomePageUrl()
  const redirected = useRef(false)

  // Recent is client-side: nothing on the server records a visit yet.
  useEffect(() => {
    if (titleForPath(pathname)) pushRecent(pathname)
  }, [pathname, pushRecent])

  // The configured home page applies to opening the platform, once: only a
  // root entry redirects, and only the first time the answer arrives.
  useEffect(() => {
    if (redirected.current || homeUrl === undefined) return
    redirected.current = true
    if (homeUrl === null || homeUrl === '/' || pathname !== '/') return
    if (homeUrl.startsWith('/')) void navigate(homeUrl, { replace: true })
    else window.location.replace(homeUrl)
  }, [homeUrl, pathname, navigate])

  // The platform title replaces references to the platform, and the favicon
  // "represents a web application throughout your web browser".
  useEffect(() => {
    if (!branding) return
    document.title = branding.title
    const favicon = branding.logos?.favicon
    if (favicon) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = favicon
    }
  }, [branding])

  // When a CBAC banner exists for the viewer, the static banner hides
  // beneath it unless its show_with_classification_banner toggle says
  // otherwise (674/675; administration's configure-static-banner.png).
  const cbac = branding?.cbac ?? null
  const banner =
    branding?.banner && (!cbac || branding.banner.show_with_classification_banner)
      ? branding.banner
      : null
  const cbacBar = cbac && (
    <div
      className="platform-cbac-banner"
      style={{
        color: cbac.text_color,
        background:
          cbac.background_colors.length > 1
            ? `linear-gradient(to right, ${cbac.background_colors
                .map((c, i) => {
                  const w = 100 / cbac.background_colors.length
                  return `${c} ${i * w}%, ${c} ${(i + 1) * w}%`
                })
                .join(', ')})`
            : (cbac.background_colors.at(0) ?? '#394B59'),
      }}
    >
      {cbac.classification_string}
    </div>
  )
  const bar = banner && (
    <div
      className={cn('platform-banner', !banner.show_when_printing && 'platform-banner-no-print')}
      style={{ background: banner.banner_color, color: banner.text_color }}
    >
      <BannerText text={banner.text} />
    </div>
  )

  return (
    <div className="platform-shell-column">
      {cbacBar}
      {banner && banner.position !== 'bottom' && bar}
      <div className="platform-shell">
        <PlatformSidebar />
        <main className="platform-main">
          <PanelErrorBoundary name="Page" className="h-full">
            <div className="page-fade h-full">
              <Outlet />
            </div>
          </PanelErrorBoundary>
        </main>
        <ServiceWorkerUpdatePrompt />
      </div>
      {banner && banner.position !== 'top' && bar}
    </div>
  )
}
