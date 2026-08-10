// Applications Portal — "a tool for discovering and accessing all apps", opened
// from the sidebar as a modal over the current page rather than as a route
// (readings/home-and-navigation.md §4). A counted rail of categories on the
// left, rows of [icon tile] name / description on the right.
//
// Promoted apps, tag filters, search and the star are all absent: they need a
// promotion workflow and a favourites store, and neither exists yet.

import { useState } from 'react'
import { Dialog, DialogBody, Icon } from '@blueprintjs/core'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { AUDIENCES } from './apps'

export function ApplicationsPortal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [category, setCategory] = useState('all')
  const shown = category === 'all' ? AUDIENCES : AUDIENCES.filter((a) => a.id === category)
  const total = AUDIENCES.reduce((n, a) => n + a.apps.length, 0)

  const open = (path: string) => () => { onClose(); void navigate(path) }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Applications Portal" style={{ width: 880 }}>
      <DialogBody className="portal-body">
        <ul className="portal-rail">
          <li>
            <button type="button" onClick={() => { setCategory('all') }}
              className={cn('portal-rail-row', category === 'all' && 'is-active')}>
              All apps <span className="portal-count">{total}</span>
            </button>
          </li>
          {AUDIENCES.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => { setCategory(a.id) }}
                className={cn('portal-rail-row', category === a.id && 'is-active')}>
                {a.title} <span className="portal-count">{a.apps.length}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="portal-apps">
          {shown.map((a) => (
            <section key={a.id}>
              <div className="portal-band">{a.title}<span className="portal-count">{a.apps.length}</span></div>
              <div className="portal-grid">
                {a.apps.map((app) => (
                  <button key={app.path} type="button" className="portal-app" onClick={open(app.path)}>
                    <span className="app-tile" style={{ background: `${app.tint}1f` }}>
                      <Icon icon={app.icon} size={18} color={app.tint} />
                    </span>
                    <span>
                      <span className="portal-app-name">{app.name}</span>
                      <span className="portal-app-blurb">{app.blurb}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogBody>
    </Dialog>
  )
}
