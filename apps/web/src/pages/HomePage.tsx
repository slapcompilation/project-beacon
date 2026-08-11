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
          {/* The amber-bordered square above NAVIGATION (§2.2 region b). */}
          <svg className="home-toc-art" viewBox="0 0 200 200" role="img" aria-label="Beacon">
            <defs>
              <linearGradient id="home-art-bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#4c2a85" />
                <stop offset="60%" stopColor="#8f3d56" />
                <stop offset="100%" stopColor="#d9822b" />
              </linearGradient>
              <linearGradient id="home-art-pour" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffd54a" />
                <stop offset="100%" stopColor="#f0883e" />
              </linearGradient>
            </defs>
            <rect width="200" height="200" rx="10" fill="url(#home-art-bg)" />
            {/* a beacon bowl, tipped, pouring light */}
            <g transform="rotate(-18 100 84)">
              <path d="M56 66h88l-10 40a34 34 0 0 1-68 0z" fill="#e8eaed" stroke="#1c2127" strokeWidth="3" />
              <rect x="92" y="26" width="16" height="26" rx="3" fill="#9aa4b2" stroke="#1c2127" strokeWidth="3" />
              <path d="M60 26h80" stroke="#1c2127" strokeWidth="6" strokeLinecap="round" />
            </g>
            <path d="M132 104c10 14 14 34 12 62l14 2c4-30-2-52-14-70z" fill="url(#home-art-pour)" stroke="#1c2127" strokeWidth="2.5" />
            <circle cx="150" cy="176" r="4" fill="#ffd54a" />
            <circle cx="138" cy="184" r="2.5" fill="#f0883e" />
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
            <p className="home-welcome-title">👋 Welcome to Beacon.</p>
            <p className="home-welcome-sub">
              Beacon is a platform built on an ontology: object types describe the things you work
              with, datasets hold what backs them, and projects decide who may see either.
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
