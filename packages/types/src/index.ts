// Types shared across the workspace, and nothing else.
//
// This file was 1,736 lines of hospitality: Hotel, Product, ProductVariant,
// StockStatus, Category, Location and forty more. The ontology describes a
// customer's own objects now — they are rows in `object_types`, not interfaces
// here — so what is left is the platform's own vocabulary.

/** Platform roles. Resource roles (owner/editor/viewer/discoverer) live on a
 *  project grant, which is Compass's model, not this one. */
export type UserRole = 'owner' | 'admin'

export interface AuthSession {
  user: {
    id: string
    email: string
    organization_id: string
    role: UserRole
  }
  access_token: string
  expires_at: number
}

/** The api name of a link type — `link_types.api_name`, resolved at runtime.
 *
 *  This was a union of forty-three hospitality verbs restating a CHECK
 *  constraint. A link type is "a relationship between object types" defined in
 *  the ontology (`mirror/object-link-types/link-types-overview.md`), so the
 *  platform cannot know the names at compile time and does not need to. */
export type EdgeType = string

export type { OntologyTypes } from './ontology.generated'
