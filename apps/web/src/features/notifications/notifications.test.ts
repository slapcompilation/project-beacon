// The two pure helpers the notifications centre renders through.
//
// Both exist because `data-health/images/notifications.png` shows what a row
// says: a sentence with an inline action link, and a relative timestamp
// underneath in the forms "1 minute ago", "15 minutes ago", "1 hour ago".

import { describe, it, expect } from 'vitest'
import { linkHref, relativeTime, type NotificationLink } from './api'

describe('relativeTime', () => {
  const now = new Date('2026-09-11T12:00:00Z').getTime()
  const ago = (seconds: number): string =>
    new Date(now - seconds * 1000).toISOString()

  it('renders the forms the capture shows', () => {
    expect(relativeTime(ago(60), now)).toBe('1 minute ago')
    expect(relativeTime(ago(900), now)).toBe('15 minutes ago')
    expect(relativeTime(ago(3600), now)).toBe('1 hour ago')
  })

  it('singularises one and pluralises the rest', () => {
    expect(relativeTime(ago(3600 * 2), now)).toBe('2 hours ago')
    expect(relativeTime(ago(86400), now)).toBe('1 day ago')
    expect(relativeTime(ago(86400 * 3), now)).toBe('3 days ago')
  })

  it('says just now rather than zero seconds ago', () => {
    expect(relativeTime(ago(0), now)).toBe('just now')
    expect(relativeTime(ago(30), now)).toBe('30 seconds ago')
  })

  it('never renders a negative age from a clock that is slightly ahead', () => {
    expect(relativeTime(new Date(now + 5000).toISOString(), now)).toBe('just now')
  })
})

describe('linkHref', () => {
  it('takes a URL target as it is', () => {
    const link: NotificationLink = {
      label: 'Docs', linkTarget: { type: 'url', url: 'https://example.test/x' },
    }
    expect(linkHref(link)).toBe('https://example.test/x')
  })

  it('routes an ontology object to its own page, key-encoded', () => {
    const link: NotificationLink = {
      label: 'Port', linkTarget: { type: 'object', objectType: 'Port', primaryKey: 'A/B' },
    }
    expect(linkHref(link)).toBe('/objects/Port/A%2FB')
  })

  it('gives a bare resource rid no href, because nothing routes one', () => {
    // "The LinkTarget can be a URL, an OntologyObject, or a rid of any resource
    //  within Foundry" — the third has no destination here, so the row renders
    //  it as text rather than as a link that goes nowhere.
    const link: NotificationLink = {
      label: 'Dataset', linkTarget: { type: 'rid', rid: 'ri.foundry.main.dataset.d1' },
    }
    expect(linkHref(link)).toBeNull()
  })
})
