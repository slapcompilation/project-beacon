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
            <svg className="home-welcome-art" viewBox="28 28 144 144" role="img" aria-hidden>
              <defs>
                <linearGradient id="home-art-core" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f2c14b" />
                  <stop offset="100%" stopColor="#d99a10" />
                </linearGradient>
              </defs>
              <ellipse cx="100" cy="168" rx="44" ry="7" fill="#000" opacity=".2" />
              <path d="M100 38 153.7 69 v62 L100 162 46.3 131 v-62 Z"
                fill="#ffffff" fillOpacity=".14" stroke="#d7c6f5" strokeWidth="2.5" strokeLinejoin="round" />
              <path d="M100 50 143.3 75 v50 L100 150 56.7 125 v-50 Z"
                fill="none" stroke="#f3eefc" strokeWidth="5" strokeLinejoin="round" opacity=".9" />
              <path d="M100 62 132.9 81 v38 L100 138 67.1 119 v-38 Z"
                fill="url(#home-art-core)" stroke="#caa50f" strokeWidth="1.5" strokeLinejoin="round" />
              <g fill="none" stroke="#a87a08" strokeWidth="4" strokeLinecap="round" opacity=".55">
                <path d="M100 68v16" />
                <path d="M100 116v16" />
                <path d="M80 92h20v16" />
                <path d="M120 108h-20v-16" />
                <path d="M124 88v10h-10" />
                <path d="M76 112v-10h10" />
              </g>
            </svg>
            <div>
              <p className="home-welcome-title">Welcome to Beacon.</p>
              <p className="home-welcome-sub">
                Beacon is where your team defines its world: the things you work with,
                the data behind them, and who can see or change what.
              </p>
            </div>
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
