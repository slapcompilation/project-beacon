// The applications this platform actually has, grouped by audience the way the
// home page groups them — Data Ops / Analytics / Operations (§2.2 of
// readings/home-and-navigation.md). All three groups exist now: Object
// Explorer is the first application that answers to Analytics.
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
        name: 'Data Lineage',
        tagline: 'See how data flows',
        blurb: 'One graph over datasets and object types: inputs, datasource bindings, materializations and links, with staleness at a glance.',
        path: '/lineage',
        icon: 'data-lineage',
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
    id: 'analytics',
    title: 'Applications for Analytics',
    apps: [
      {
        name: 'Object Explorer',
        tagline: 'Search and analyze objects',
        blurb: 'Filter object sets, aggregate them as charts, and read the results as a table over the live index.',
        path: '/explorer',
        icon: 'search-template',
        tint: '#7961db',
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
      {
        name: 'Branching',
        tagline: 'Safely build, test, and merge changes',
        blurb: 'Branches and proposals: experiment without affecting Main, then review and merge through approvals.',
        path: '/branches',
        icon: 'git-branch',
        tint: '#634dbf',
      },
      {
        name: 'Value Types Manager',
        tagline: 'Declare reusable semantic types',
        blurb: 'Author a value type per space — a base type plus a constraint, versioned — and bind it to properties in Ontology Manager.',
        path: '/value-types',
        icon: 'tag',
        tint: '#00a396',
      },
    ],
  },
]

/** Every app, flat — what the portal stars, the sidebar favourites and
 *  Quicksearch's `Apps` kind all read. */
export const ALL_APPS: PlatformApp[] = AUDIENCES.flatMap((a) => a.apps)

const TITLES = new Map<string, string>([
  ['/', 'Home'],
  ['/account', 'Account'],
  ...AUDIENCES.flatMap((a) => a.apps.map((app): [string, string] => [app.path, app.name])),
  // Ontology Manager's own pages, so Recent can name one rather than dropping it.
  ['/ontology/object-types', 'Object types'],
  ['/ontology/shared-properties', 'Shared Properties'],
  ['/ontology/link-types', 'Link types'],
  ['/ontology/action-types', 'Action types'],
  ['/ontology/interfaces', 'Interfaces'],
  ['/ontology/proposals', 'Proposals'],
  ['/ontology/main-branch-updates', 'Main branch updates'],
])

/** A path we can name. Recent lists nothing else — an unnamed row is a dead row. */
export function titleForPath(path: string): string | undefined {
  return TITLES.get(path)
}
