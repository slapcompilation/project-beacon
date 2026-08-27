// The home page's application groups, exactly as the captured Foundry home
// draws them (readings/home-and-navigation.md §2.2, getting-started/images/
// homepage.png): three audiences — Data Ops / Analytics / Operations — whose
// seventeen cards the reading holds verbatim. AUDIENCES carries ONLY the
// cards that page shows and this platform actually has, in that page's order
// and with that page's taglines. My earlier grouping was invented — it filed
// Object Explorer under Analytics when the capture's Operations grid lists it
// first, put Catalog in Analytics, and padded the groups with platform tools
// the Foundry home never shows.
//
// Everything else we run (builders, governance, admin) is a platform tool:
// reachable from the portal, the sidebar and search, never a home card —
// PLATFORM_TOOLS below, filed in the portal under the CAPTURED category
// names via APP_CATEGORY.
//
// Two descriptions per app, on purpose: "the same app carries different
// one-liners on different surfaces" (§7.5), so the card and the portal each
// say it their own way rather than sharing one canonical string.

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
  /** Named on the capture, absent here — the home section says so instead
   *  of standing empty without explanation. */
  missing?: string
}

export const AUDIENCES: AppAudience[] = [
  {
    id: 'data-ops',
    title: 'Applications for Data Ops',
    // The capture's six: Dataset, Code repositories, Data Lineage, Projects,
    // Data prep, Catalog. We hold five since 690; Data prep is not built.
    apps: [
      {
        name: 'Dataset',
        tagline: 'Branch and version data',
        blurb: 'Create a dataset, commit transactions on a branch, and read the view they build up to.',
        path: '/datasets',
        icon: 'th',
        tint: '#2d72d2',
      },
      {
        name: 'Data Lineage',
        tagline: 'Manage data pipelines',
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
        tint: '#2d72d2',
      },
      {
        name: 'Catalog',
        tagline: 'Endorse trusted data assets',
        blurb: 'Collections group the most useful files for a topic or audience; Promoted items surface first, and tags filter the rest.',
        path: '/catalog',
        icon: 'endorsed',
        tint: '#7961db',
      },
      {
        name: 'Code repositories',
        tagline: 'Author data pipelines',
        blurb: 'Transforms and functions in a repository: sandbox branches, commits, pull requests and checks, with protected branches reached only through review.',
        path: '/code',
        icon: 'code',
        tint: '#2d72d2',
      },
    ],
    missing: 'Data prep is sunset in Foundry, which recommends Pipeline Builder instead, so it is deliberately not built here.',
  },
  {
    id: 'analytics',
    title: 'Applications for Analytics',
    // The capture's six: Code workbook, Machine Learning, Contour, Reports,
    // Quiver, Vertex. Quiver is built since 696, Machine Learning since 699;
    // Reports is sunset.
    apps: [
      {
        name: 'Machine Learning',
        // the capture's own tagline
        tagline: 'Manage and deploy models',
        blurb: 'Models are artifacts plus a typed adapter; objectives manage their submissions, checks, reviews and releases; deployments pick up the latest release carrying their tag, and a batch run writes a real dataset transaction.',
        path: '/modeling',
        icon: 'predictive-analysis',
        tint: '#2d72d2',
      },
      {
        name: 'Quiver',
        // the capture's own tagline, kept verbatim even though the time
        // series half of Quiver is catalogued here rather than built
        tagline: 'Explore time series data',
        blurb: 'A typed graph of cards over the ontology: every card takes typed inputs and emits one typed output, so only the cards that fit can follow. Object and scalar cards are built; the time series ones are catalogued and refuse by name, because this platform has no time series store.',
        path: '/quiver',
        icon: 'chart',
        tint: '#2d72d2',
      },
    ],
    missing: 'Code Workbook, Contour and Vertex are not built here yet. Reports is sunset in Foundry and deliberately will not be.',
  },
  {
    id: 'operations',
    title: 'Applications for Operations',
    // The capture's five: Object Explorer, Fusion, Forms, Slate, Workshop.
    // Four are built; Forms is sunset in Foundry and deliberately is not.
    apps: [
      {
        name: 'Object Explorer',
        tagline: 'Explore business nouns and verbs',
        blurb: 'Filter object sets, aggregate them as charts, and read the results as a table over the live index.',
        path: '/explorer',
        icon: 'search-template',
        tint: '#7961db',
      },
      {
        name: 'Workshop',
        tagline: 'Build interactive, object-backed apps',
        blurb: 'Lay out pages of widgets over the object layer — everything a module shows is read from the ontology rather than copied out of it.',
        path: '/workshop',
        icon: 'applications',
        tint: '#5c7080',
      },
      {
        name: 'Fusion',
        tagline: 'Use familiar spreadsheet interface',
        blurb: 'A spreadsheet whose table regions sync to datasets, so a sheet of numbers becomes something the rest of the platform can build on.',
        path: '/fusion',
        icon: 'th',
        tint: '#0f9960',
      },
      {
        name: 'Slate',
        tagline: 'Create an application',
        blurb: 'Widgets on a canvas wired to each other by name, drawing data from queries rather than the object layer alone.',
        path: '/slate',
        icon: 'control',
        tint: '#7961db',
      },
    ],
    missing: 'Forms is sunset in Foundry, which recommends Actions and Functions instead — both of which this platform already has — so it is deliberately not built.',
  },
]

/** The portal's category rail uses the CAPTURED names — "All apps 75 …
 *  Platform apps 40 … Analyze data 7 … Build & monitor pipelines 10 … Data
 *  Governance 4 … Manage & deploy models 1 … Operational applications 13 …
 *  Support 5" (getting-started/images/apps-portal.png) — in that order.
 *  Empty categories are simply not rendered. */
export const PORTAL_CATEGORIES = [
  'Analyze data',
  'Build & monitor pipelines',
  'Data Governance',
  'Manage & deploy models',
  'Operational applications',
  'Support',
] as const

export type PortalCategory = typeof PORTAL_CATEGORIES[number]

/** Which captured category each app files under. Exactly ONE placement is
 *  documented — Checkpoints: "The Checkpoints application can be accessed in
 *  the navigation panel in the **Data Governance** category."
 *  (checkpoints/overview.md). Every other row is inference from the app's
 *  own register; the capture never lists its 40 platform apps by name. */
export const APP_CATEGORY: Record<string, PortalCategory> = {
  '/catalog': 'Analyze data',
  '/quiver': 'Analyze data',
  '/modeling': 'Manage & deploy models',
  '/datasets': 'Build & monitor pipelines',
  '/code': 'Build & monitor pipelines',
  '/lineage': 'Build & monitor pipelines',
  '/builds': 'Build & monitor pipelines',
  '/data-health': 'Build & monitor pipelines',
  '/checkpoints': 'Data Governance',            // the one documented placement
  '/approvals': 'Data Governance',
  '/projects': 'Data Governance',
  '/control-panel': 'Data Governance',
  '/explorer': 'Operational applications',
  '/workshop': 'Operational applications',
  '/fusion': 'Operational applications',
  '/slate': 'Operational applications',
  '/ontology': 'Operational applications',
  '/branches': 'Operational applications',
  '/automate': 'Operational applications',
  '/value-types': 'Operational applications',
}

/** What we run that the Foundry home never shows: builders, governance and
 *  administration. Portal, sidebar and search surface them; Home does not. */
export const PLATFORM_TOOLS: PlatformApp[] = [
  {
    name: 'Ontology Manager',
    tagline: 'Define object types backed by datasources',
    blurb: 'Author object types, their properties and keys, link types, shared properties and interfaces.',
    path: '/ontology',
    icon: 'cube',
    tint: '#7961db',
  },
  {
    name: 'Builds',
    tagline: 'Compute datasets from their inputs',
    blurb: 'JobSpecs pair declared inputs with one SQL SELECT; a build runs the jobs, locks each output with a transaction, and skips what is fresh.',
    path: '/builds',
    icon: 'play',
    tint: '#2d72d2',
  },
  {
    name: 'Data Health',
    tagline: 'Monitor datasets for issues',
    blurb: 'Health checks watch datasets for stale data, shrunken row counts and schema drift, with a result history and per-user watching.',
    path: '/data-health',
    icon: 'pulse',
    tint: '#2d72d2',
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
    name: 'Automate',
    tagline: 'Run effects when a condition is met',
    blurb: 'Define conditions and effects. Conditions are checked continuously, and effects are executed automatically when the specified conditions were met.',
    path: '/automate',
    icon: 'flash',
    tint: '#c87619',
  },
  {
    name: 'Value Types Manager',
    tagline: 'Declare reusable semantic types',
    blurb: 'Author a value type per space — a base type plus a constraint, versioned — and bind it to properties in Ontology Manager.',
    path: '/value-types',
    icon: 'tag',
    tint: '#00a396',
  },
  {
    name: 'Approvals',
    tagline: 'Request, review, invoke',
    blurb: 'File a request for a change you cannot make yourself; whoever could make it directly reviews, and an approved request applies itself.',
    path: '/approvals',
    icon: 'inbox',
    tint: '#7961db',
  },
  {
    name: 'Checkpoints',
    tagline: 'Justify sensitive interactions',
    blurb: 'Checkpoint configurations interrupt sensitive interactions with a justification prompt; every submitted justification is a reviewable record.',
    path: '/checkpoints',
    icon: 'flag',
    tint: '#7961db',
  },
  {
    name: 'Control Panel',
    tagline: 'Administer the platform',
    blurb: 'Authentication: rule-based group assignment and organization assignment, evaluated at every login.',
    path: '/control-panel',
    icon: 'settings',
    tint: '#7961db',
  },
]

/** Every app, flat — what the portal stars, the sidebar favourites and
 *  Quicksearch's `Apps` kind all read. */
export const ALL_APPS: PlatformApp[] = [
  ...AUDIENCES.flatMap((a) => a.apps),
  ...PLATFORM_TOOLS,
]

const TITLES = new Map<string, string>([
  ['/', 'Home'],
  ['/account', 'Account'],
  ['/settings', 'Settings'],
  ...ALL_APPS.map((app): [string, string] => [app.path, app.name]),
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
