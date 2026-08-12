// The platform landing page (readings/home-and-navigation.md §2.2): a NAVIGATION
// column that mirrors the section headings, a welcome banner, then app cards
// grouped by audience. Foundry's own is configuration rather than a fixed page —
// "New Palantir enrollments come with a default home page" — so this is ours,
// in our words.
//
// The screenshot's square illustration is an inline SVG below — the same slot
// and format (amber-bordered square, warm gradient, a pouring vessel), drawn as
// Beacon's own mark rather than a copy of Palantir's artwork. The old note: a
// placeholder box reads as a broken image.

import { useEffect, useState } from 'react'
import { Icon } from '@blueprintjs/core'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { AUDIENCES } from '@/features/platformShell/apps'

export default function HomePage() {
  const [active, setActive] = useState(AUDIENCES[0].id)

  // The TOC entry follows the section you are actually reading, not the last click.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting)
        if (hit) setActive(hit.target.id)
      },
      { rootMargin: '-10% 0px -70% 0px' },
    )
    for (const a of AUDIENCES) {
      const el = document.getElementById(a.id)
      if (el) observer.observe(el)
    }
    return () => { observer.disconnect() }
  }, [])

  return (
    <div className="home-page">
      <div className="home-grid">
        <nav className="home-toc">
          {/* The square above NAVIGATION (§2.2 region b) — a line-drawn
              beacon on the same slate surface as the welcome panel. */}
          <svg className="home-toc-art" viewBox="0 0 200 200" role="img" aria-label="Beacon">
            <defs>
              <pattern id="home-art-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="#22303e" />
              </pattern>
            </defs>
            <rect width="200" height="200" rx="8" fill="#141a21" />
            <rect width="200" height="200" rx="8" fill="url(#home-art-grid)" />
            {/* the tower */}
            <path d="M100 62 86 148 h28 L100 62z" fill="none" stroke="#8b98a5" strokeWidth="2" strokeLinejoin="round" />
            <path d="M91 118h18M94 92h12" stroke="#8b98a5" strokeWidth="1.5" />
            <path d="M60 148h80" stroke="#2e3d4d" strokeWidth="2" strokeLinecap="round" />
            {/* the light, and its signal */}
            <circle cx="100" cy="52" r="4.5" fill="#2d72d2" />
            <path d="M112 40a17 17 0 0 1 0 24" fill="none" stroke="#2d72d2" strokeWidth="2" strokeLinecap="round" />
            <path d="M120 31a29 29 0 0 1 0 42" fill="none" stroke="#2d72d2" strokeWidth="2" strokeLinecap="round" opacity=".55" />
            <path d="M128 22a41 41 0 0 1 0 60" fill="none" stroke="#2d72d2" strokeWidth="2" strokeLinecap="round" opacity=".3" />
            <path d="M88 40a17 17 0 0 0 0 24" fill="none" stroke="#2d72d2" strokeWidth="2" strokeLinecap="round" />
            <path d="M80 31a29 29 0 0 0 0 42" fill="none" stroke="#2d72d2" strokeWidth="2" strokeLinecap="round" opacity=".55" />
            <path d="M72 22a41 41 0 0 0 0 60" fill="none" stroke="#2d72d2" strokeWidth="2" strokeLinecap="round" opacity=".3" />
          </svg>
          <span className="home-toc-label">NAVIGATION</span>
          {AUDIENCES.map((a) => (
            <button key={a.id} type="button"
              className={cn('home-toc-link', active === a.id && 'is-active')}
              onClick={() => { document.getElementById(a.id)?.scrollIntoView({ behavior: 'smooth' }) }}>
              <span aria-hidden>➤</span>{a.title}
            </button>
          ))}
        </nav>

        <div>
          <div className="home-welcome">
            <p className="home-welcome-title">Welcome to Beacon.</p>
            <p className="home-welcome-sub">
              One place for your team's shared definitions and the data behind them —
              versioned, reviewed before changes land, and visible only to the people you choose.
            </p>
          </div>

          {AUDIENCES.map((a) => (
            <section key={a.id} id={a.id} className="home-section">
              <h2 className="home-section-title">{a.title}</h2>
              <div className="home-app-grid">
                {a.apps.map((app) => (
                  <Link key={app.path} to={app.path} className="home-app-card">
                    <span className="app-tile" style={{ background: `${app.tint}1f` }}>
                      <Icon icon={app.icon} size={20} color={app.tint} />
                    </span>
                    <span>
                      <span className="home-app-name">{app.name}</span>
                      <span className="home-app-tagline">{app.tagline}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
