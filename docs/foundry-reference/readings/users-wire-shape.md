---
verify: strict
---

# The User wire shape, and the fields ours is missing

The queue's entry: 656 gave users a realm and recorded three residuals; the
User resource has more fields than our table, and the prose page carries
soft-delete and inactivity semantics no reading held.

**What I read, counted rather than asserted.** All eleven
`api/admin-v2-resources-users-*` pages whole: `user-basics` (a one-sentence
stub), `get-user`, `get-current-user`, `list-users`, `search-users`,
`get-users-batch` (max batch 500), `delete-user`, `get-markings-user`,
`get-profile-picture-of-user`, `revoke-all-tokens-user`, and the `users`
section stub (which repeats the basics sentence). Plus
`platform-security-management/manage-users` whole. **Images: one of one
parsed** — `platform-security-management/images/manage-users.png`.

## 1. The shape, field by field against our table

> "A User represents individual user or service account in Foundry."

— `api/admin-v2-resources-users-user-basics.md`

The resource (identical across get/getCurrent/list/search):

> "The Foundry username of the User. This is unique within the realm."

— `api/admin-v2-resources-users-get-user.md`

> "The given name of the User."

— `api/admin-v2-resources-users-get-user.md`

> "The family name (last name) of the User."

— `api/admin-v2-resources-users-get-user.md`

> "The email at which to contact a User. Multiple users may have the same email address."

— `api/admin-v2-resources-users-get-user.md`

> "The current status of the user."

— `api/admin-v2-resources-users-get-user.md`

(an enum of `ACTIVE`, `DELETED`; required), and:

> "A map of the User's attributes. Attributes prefixed with "multipass:" are reserved for internal use by Foundry and are subject to change. Additional attributes may be configured by Foundry administrators in Control Panel and populated by the User's SSO provider upon login."

— `api/admin-v2-resources-users-get-user.md`

(`AttributeName` → a LIST of `AttributeValues`). `realm` (656) and
`organization` — "The RID of the user's primary Organization. This will be
blank for third-party application service users." — we hold; `id`, `email`
we hold. **Missing: `username`, `givenName`, `familyName`, `status`,
`attributes`.**

## 2. Deletion is soft, and the prose says so twice

> "If a login fails with the error `Your account has been disabled`, it means the user account has been deleted. You can reach out to an administrator to find and "undelete" the account using the `getDeletedUsers` and `undeleteExternalUser` endpoints, respectively."

— `platform-security-management/manage-users.md`

A DELETED user still exists — listable (`list-users` takes
`include=DELETED`), recoverable, and excluded from search:

> "Perform a case-insensitive prefix search for active users based on username, given name and family name."

— `api/admin-v2-resources-users-search-users.md`

Every per-user endpoint refuses the deleted with the same error —
`UserDeleted` ("The user is deleted.").

## 3. Inactivity is a different thing from deletion

> "Foundry user accounts are automatically considered inactive if no successful login has occurred for 30 days. Inactive accounts behave in the same way as active accounts in Foundry, except that all tokens for the inactive user account are invalid while the account is inactive."

— `platform-security-management/manage-users.md`

Reactivation is automatic on login, no administrator involved. This is a
token-layer behaviour, not a status value — the status enum stays two.

## 4. What the capture adds that the prose does not

The prose lists the administration page's columns as User ID, Organization,
Groups, Attributes — but the capture's table draws **Username | Given name |
Family name | Organization | Realm**
(`platform-security-management/images/manage-users.png`), with the row
`lsegura · Linda · Segura · Sky Industries · palantir-intern…`. The two
enumerations disagree; the capture is the drawn surface and wins for the
surface. Its details panel: an initials avatar, `Linda Segura (lsegura)`
with Edit, the email as a link, User ID (copyable uuid), Organization with
Manage, Groups with Manage (rows like `Flight Delays [Transform] - Editor`),
and **Attributes rendered as name-over-values pairs:
`multipass:realm-name` → `Palantir Internal`, `location:country` →
`Germany`** — the reserved prefix live, beside a custom one
(`platform-security-management/images/manage-users.png`). Header: `User
administration (1 user)`, a search box, a `Pre-register user` button beside
a green `Create user`. The sidebar's PLATFORM SETTINGS section lists
Groups, Markings, Organizations, Roles, Row-level policies, Tags,
Third-party applications, Users.

## 5. What our substrate holds, probed

`public.users`: id, email, role, preferences, created_at, organization_id,
realm — no username, names, status, or attributes. `login_attribute(user,
name)` is the conditions engine's fail-closed resolver and today answers
only `email` from this same table — 656 called the attributes map "the
general store our conditions' one attribute foreshadows", and this is that
store arriving. Supabase's `auth.users` carries `last_sign_in_at` (the
inactivity clock exists) and unique emails — our login identifier IS the
email, which matters for the preregistration callout:

> "The created username needs to match the user’s login username exactly for the preregistered actions to work."

— `platform-security-management/manage-users.md`

## Decisions

1. **Three columns on users**: `username` text NOT NULL with a UNIQUE index
   on (realm, username) — unique WITHIN the realm, exactly as published —
   plus `given_name` and `family_name`, nullable. Backfill username from
   the email (our internal realm's login username is the email, and the
   preregistration callout says the two must match — so the email IS the
   faithful backfill, not an invention).
2. **`status` with the wire's own tokens** — CHECK IN ('ACTIVE','DELETED'),
   default ACTIVE, declared `Values from` the get-user page. Wire vocabulary
   kept verbatim (the 656 rule: vocabulary, not trademark). Deletion is an
   UPDATE, not a DELETE — the prose's undelete depends on the row surviving.
3. **`user_attributes` as a real table** — (user_id, name, values text[]),
   PK (user_id, name): the map-of-lists shape, one row per attribute.
   `login_attribute` learns to read it: the table first, the email fallback
   the conditions engine already relies on unchanged. The `multipass:`
   prefix is reserved — a guard refuses writing it from admin paths, and
   the platform stamps `multipass:realm-name` the way the capture shows it.
4. **A `UserDeleted` gate where the platform touches a user**: every
   per-user admin endpoint refuses deleted users; ours should refuse
   granting roles, group memberships, and marking memberships to a DELETED
   user, raising the published name. Enforced as a small trigger set or a
   composed predicate, chosen at build time by what exists.
5. **Recorded, not built, each with its reason**: profile pictures (a
   binary store; nothing renders avatars beyond initials), `revoke-all-
   tokens` (Supabase owns sessions; deleting auth refresh tokens is
   substrate surgery for another day), the 30-day inactivity behaviour
   (token-layer, same reason), preregistration (the external-provider day,
   as the queue already records), and the search/list/batch endpoints as
   endpoints (our surface queries the table; the search page's spec —
   case-insensitive prefix over username, given name, family name,
   active only — is the surface's search behaviour).
6. **The surface follows the capture, not the prose's column list** — the
   two disagree and the capture is the drawn thing: Username | Given name |
   Family name | Organization | Realm columns, the details panel's blocks
   in its order (identity, User ID, Organization, Groups, Attributes), a
   search box that prefix-matches the three name fields. Own PR.

## Questions

1. **What is a username for an email-login realm?** Ours: the email,
   backfilled; a future external provider brings its own usernames.
   `blocks: nothing.`
2. **Does anything undelete besides the two endpoints?** No page says; ours
   is the same UPDATE that deleted. `blocks: nothing.`
3. **Are attribute names namespaced beyond `multipass:`?** The capture
   shows `location:country`; the prose says only that admins configure
   them. Ours: free-form names, one reserved prefix. `blocks: nothing.`
