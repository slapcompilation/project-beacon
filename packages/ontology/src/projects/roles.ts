// @vocabulary-declaration — restates the database CHECKs; not a consumer.
// Project roles — Foundry's discretionary access control.
//
// "Projects are the primary way to organize work in Foundry, and the primary
// security boundary... Together, Projects and roles are how discretionary access
// control is managed across Foundry."
//
// The distinction that makes this safe to adopt:
//
//   "like mandatory controls, role grants inherit to child resources... However,
//    mandatory controls, Organizations and Markings, will ALWAYS prevent an
//    ineligible user from accessing a resource, regardless of the user's role."
//
// So roles are DISCRETIONARY and sit inside the mandatory boundary. Ours are
// organization and hotel scope, enforced by RLS and unchanged by any of this. A
// project role can widen what a member may do WITHIN their org; it can never
// reach across one. Anything else would make a grant a privilege-escalation
// path.

export const PROJECT_ROLES = ['owner', 'editor', 'viewer', 'discoverer'] as const
export type ProjectRole = typeof PROJECT_ROLES[number]

/** "From most powerful to least powerful: Owner, Editor, Viewer, Discoverer." */
const RANK: Record<ProjectRole, number> = {
  owner: 4, editor: 3, viewer: 2, discoverer: 1,
}

export const ROLE_META: Record<ProjectRole, { label: string; help: string }> = {
  owner:      { label: 'Owner',      help: 'Full control, including granting roles to others.' },
  editor:     { label: 'Editor',     help: 'Can change the resources in this project.' },
  viewer:     { label: 'Viewer',     help: 'Can see the resources in this project.' },
  discoverer: { label: 'Discoverer', help: 'Can see that the project exists, and request access.' },
}

/** Does `held` satisfy a requirement of `needed`? Higher rank satisfies lower —
 *  an Owner can do anything a Viewer can. */
export function roleAtLeast(held: ProjectRole | null | undefined, needed: ProjectRole): boolean {
  return held != null && RANK[held] >= RANK[needed]
}

/** "Each role can assign other users the same or lesser role. For example, an
 *  Owner can grant any other user the Owner, Editor, Viewer, or Discoverer role,
 *  while the Discoverer can only grant other users the Discoverer role." */
export function canGrant(granter: ProjectRole | null | undefined, target: ProjectRole): boolean {
  return granter != null && RANK[granter] >= RANK[target]
}

/** Roles this holder may hand out — what a grant picker should offer. */
export function grantableRoles(granter: ProjectRole | null | undefined): ProjectRole[] {
  return PROJECT_ROLES.filter((r) => canGrant(granter, r))
}

/** The effective role on a resource. Grants live on the PROJECT — Foundry
 *  disables folder- and file-level grants by default and recommends leaving them
 *  off — so a resource's role is simply its project's. */
export function effectiveRole(
  projectRole: ProjectRole | null | undefined,
): ProjectRole | null {
  return projectRole ?? null
}
