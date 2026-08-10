// The platform landing page (readings/home-and-navigation.md §2.2): a NAVIGATION
// column that mirrors the section headings, a welcome banner, then app cards
// grouped by audience. Foundry's own is configuration rather than a fixed page —
// "New Palantir enrollments come with a default home page" — so this is ours,
// in our words.
//
// The screenshot's square illustration is skipped: we have no artwork, and a
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
