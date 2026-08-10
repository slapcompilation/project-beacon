// The applications this platform actually has, grouped by audience the way the
// home page groups them — Data Ops / Analytics / Operations (§2.2 of
// readings/home-and-navigation.md). We have two of the three groups; Analytics
// is absent because no application answers to it yet.
//
// Two descriptions per app, on purpose: "the same app carries different
// one-liners on different surfaces" (§7.5), so the card and the portal each say
// it their own way rather than sharing one canonical string.

import type { IconName } from '@blueprintjs/icons'

export interface PlatformApp {
  name: string
  /** The home page card's one line. */
  tagline: string
  /** The portal's longer register. */
  blurb: string
  path: string
  icon: IconName
  tint: string
}

export interface AppAudience {
  id: string
  title: string
  apps: PlatformApp[]
}

export const AUDIENCES: AppAudience[] = [
  {
    id: 'data-ops',
    title: 'Applications for Data Ops',
    apps: [
      {
        name: 'Dataset',
        tagline: 'Branch and version data',
        blurb: 'Create a dataset, commit transactions on a branch, and read the view they build up to.',
        path: '/datasets',
        icon: 'database',
        tint: '#2d72d2',
      },
      {
        name: 'Projects',
        tagline: 'Manage access controls',
        blurb: 'The security boundary: grant owner, editor, viewer or discoverer on a project and everything inside it.',
        path: '/projects',
        icon: 'folder-close',
        tint: '#c87619',
      },
    ],
  },
  {
    id: 'operations',
    title: 'Applications for Operations',
    apps: [
      {
        name: 'Ontology Manager',
        tagline: 'Define object types backed by datasources',
        blurb: 'Author object types, their properties and keys, link types, shared properties and interfaces.',
        path: '/ontology',
        icon: 'cube',
        tint: '#7961db',
      },
    ],
  },
]

const TITLES = new Map<string, string>([
  ['/', 'Home'],
  ['/account', 'Account'],
  ...AUDIENCES.flatMap((a) => a.apps.map((app): [string, string] => [app.path, app.name])),
])

/** A path we can name. Recent lists nothing else — an unnamed row is a dead row. */
export function titleForPath(path: string): string | undefined {
  return TITLES.get(path)
}
