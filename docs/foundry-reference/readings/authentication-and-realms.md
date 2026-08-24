---
verify: strict
---

# Authentication and realms

The identity-provider phase, recorded since 639 widened `group_type` to the
published three and left external and rule_based without a producer or a
realm. The `authentication/` section turns out to be fully mirrored — twenty
pages — and the mechanism is small and precise: providers supply users,
attributes and groups; rules over those assign groups and the organization
AT LOGIN; realms name which provider a group answers to.

**What I read, counted rather than asserted.** Five pages whole:
`authentication/overview` (7 lines; `authentication/_index` is byte-identical
past the source line — the sixth double-mirrored slug),
`authentication/group-assignment` (51), `authentication/org-assignment` (53),
`authentication/user-directory` (133), and
`platform-security-management/manage-groups` §User realms (lines 140-178; its
earlier sections were read in the groups arc). **Fourteen pages of the
section deliberately not read**: the SAML/OIDC/SCIM configuration how-tos
(`saml-getting-started`, `saml-azure-ad`, `saml-okta`, `saml-other-idp`,
`saml-provider-update`, `oidc-getting-started`, `scim-overview`,
`scim-enable`, `scim-entra-id`, `scim-other-idp`, `scim-common-issues`,
`test-provider-integration`, `host-settings`, `intake-forms`,
`multi-factor-auth`, `group-assignment` aside) are provider-specific setup
guides for external systems this platform does not integrate; they are the
corpus for the day a real SAML/OIDC integration is built.

**Images: four of sixty-three parsed** — `rule-based-groups-rules.png`,
`managing-rbgs.png`, `rule-based-group-testing.png`,
`advanced-user-rules.png`, the four that carry the rules grammar §3-4 build
on. The other fifty-nine are the how-tos' provider walkthroughs, the
user-directory dialogs, and the org-assignment variants — named by the
census above, unparsed, each illustrating either an unread how-to or a
prose step already quoted.

## 1. Providers are the root

> "Access to Foundry is managed by one or more *identity providers* that give Foundry the ability to validate users. The identity providers provide Foundry with information about users, attributes, and groups."

— `authentication/overview.md`

Integration is SAML 2.0 or OIDC; configuration lives in Control Panel's
Authentication tab. And the internal fallback is published as a real thing:

> "Administrators typically set up external realm providers (such as SSO, SAML realm, or ADFS) in Control Panel. If necessary, Foundry’s Platform Settings come with an internal implementation of an identity provider."

— `platform-security-management/manage-groups.md`

`authentication/user-directory` is that internal provider's manual: add
users by email invitation, passkeys (at most four per user, admin-managed),
disable/enable/delete, gated by the `enrollment administrator` or
`authentication administrator` role.

## 2. Realms: which provider a group answers to

> "External realms are groups directly derived from external systems, such as an identity provider like ADFS. The Platform Settings configuration defines the realms where the identity providers are assigned."

— `platform-security-management/manage-groups.md`

External-realm groups are read-only in Foundry ("Operations that can only be
performed in the external system include renaming, adding users to groups,
modifying attributes, and creating new groups"); they cannot be requested
(the request-access flow shows a per-realm custom message and URL instead);
and one warning is load-bearing:

> "All external realm groups must be assigned an Organization. If no Organization is assigned, the group will become visible to all users regardless of their Organization."

— `platform-security-management/manage-groups.md`

Internal-realm groups are the ones Foundry creates and edits — and the
nesting recommendation is explicit: when external realms are in use, nest
external groups inside internal ones rather than assigning users directly.

## 3. Rule based groups: rules per provider, evaluated at login

> "Membership to a rule based group is automatically assigned based on rules evaluated at login. These rules can be configured for each authentication provider."

— `authentication/group-assignment.md`

> "Group assignment rules contain one or more `AND` conditions that are evaluated against user attributes or provider groups. For each rule, users who match all conditions will be assigned membership to the specified rule based group. Administrators can specify `OR` conditions by defining separate assignment rules applied to the same group."

— `authentication/group-assignment.md`

Three match kinds, enumerated: **Includes**, **Does not include**, **Is
equal to** — regex all three. The captures carry the grammar the prose
implies: a rule row reads If user's [attribute] [match kind] [regex] →
[group] (`authentication/images/rule-based-groups-rules.png`), and the
attribute picker enumerates **Provider groups** plus the multipass
attributes — `multipass:email:primary`, `multipass:family-name`,
`multipass:given-name`. A group's page shows its rules grouped **From
[provider]** with numbered rows
(`authentication/images/managing-rbgs.png`), under the sentence "The
following rules are applied at login."

Two operational facts: "Rules *do not run retroactively* upon saving", and
testing is first-class — a Test rules panel simulates an existing user and
answers with the matched rule number and resulting group
(`authentication/images/rule-based-group-testing.png`); "only users who have
already logged in with this provider can be simulated".

## 4. Organization assignment: ordered, first-match, refuse-on-none

> "Users are assigned their primary Organization upon login. A user's primary Organization is determined in the Organization assignment section of the identity provider integration used to log in."

— `authentication/org-assignment.md`

Default Organization for the simple case; advanced rules otherwise — and
the capture states the semantics the prose leaves loose: "The following
rules are applied in order at login. People will be assigned to the
organization in the first rule they match"
(`authentication/images/advanced-user-rules.png`), with a Default
organization row beneath — "If a user does not match any of the rules above"
(`authentication/images/advanced-user-rules.png`) — and the warning that no
organization set means "login will fail for users who do not match any
rules" (`authentication/images/advanced-user-rules.png`). The prose's
version of the refusal:

> "If a user is assigned `No organization` (either via the default Organization functionality or by applying advanced rules), then they will be blocked from logging in."

— `authentication/org-assignment.md`

Group rules mark PROVIDER groups with organizations by name-matching; a
provider group with no organization "will be assigned to the organization of
the most recent member to log in".

## 5. What this platform already has

GoTrue (Supabase auth) IS our internal identity provider — email
invitations, credentials, the enrollment's user directory — and
`custom_access_token_hook` is our login-time execution point: GoTrue calls
it on every token issuance, which is exactly where "evaluated at login"
lives. `groups.group_type` already admits internal/external/rule_based
(639), with rule_based and external producer-less — the gap this phase
closes for rule_based. The audit line's ContextualizedUser.realm and the
request-access external-group redirect both wait on the realm column this
phase adds.


## 6. The api settles the wire shapes (2026-08-24 audit pass)

Read after the engine shipped, correcting forward (656):

- **The realm has a published identifier.** "The `palantir-internal-realm`
  is used for Users or Groups that are created in Foundry by administrators
  and not associated with any SSO provider"
  (`api/admin-v2-resources-authentication-providers-get-authentication-provider.md`)
  — Decision 1 named our provider 'internal' where a wire constant exists;
  providers now carry `realm` text holding it, verbatim as wire vocabulary.
- **Users carry a realm too**, required on the User shape, and "The Foundry
  username of the User. This is unique within the realm"
  (`api/admin-v2-resources-users-get-user.md`). users.realm added, and the
  audit ContextualizedUser now populates its realm — a scoped divergence
  from Foundry's pipeline, whose emptiness is a stated latency artifact
  that does not apply when the identity provider is the same database.
- **The provider wire shape** also carries `enabled`, `supportedHosts`,
  `supportedUsernamePatterns` and a `protocol` union (saml with full
  service-provider metadata) — recorded; they arrive with external
  providers.
- **Recorded, not built**: the user/group `attributes` map (name → LIST of
  values, `multipass:`-prefixed names reserved, "populated by the User's
  SSO provider upon login" — the general store Question 2 foreshadowed, and
  the reason group-assignment speaks of array-type attributes); the Group
  shape's `organizations` LIST ("At least one Organization RID must be
  listed" — multi-organization group visibility, a policy refactor of its
  own); the User `status` enum (ACTIVE, DELETED).

## Decisions

1. **`authentication_providers`, config-as-data, internal-only at first.**
   One row per provider (name, kind). The kind vocabulary admits `internal`
   alone — SAML and OIDC are the published integrations but a saml row with
   no SAML machinery is a lie; the kinds arrive with their machinery (the
   emit-only rule, applied to a provider kind). The one internal row is
   GoTrue, seeded in the migration, named as this deployment's own realm.
2. **`groups.realm` is a foreign key to the provider.** Internal groups are
   backfilled to the internal realm; a rule_based group's realm is the
   provider its rules hang off; external stays producer-less until a real
   external provider exists (and external-realm read-onlyness and the
   must-have-an-organization warning become constraints THEN, with their
   producer). This closes 639's missing attribute and feeds the audit
   enrichment later.
3. **`group_assignment_rules` + `group_assignment_conditions`**: a rule
   belongs to a provider and names a rule_based group; conditions are
   AND-rows (attribute — `provider_groups` or an attribute name — match
   kind from the page's three, regex pattern); OR is a second rule to the
   same group, the page's own encoding. Writers: organization
   administrators (the Control Panel gate we have).
4. **Evaluation lives in the login path**: `custom_access_token_hook` calls
   an evaluator that, for the internal provider, matches conditions against
   the user's attributes (email as `multipass:email:primary`'s analogue —
   marked ours; we have no provider groups until an external provider
   exists) and SYNCS rule_based membership for that provider's groups —
   assign on match, remove on no-match, because "legibility and consistency
   in group membership" is the page's stated point and a stale assignment
   is neither. Sync-vs-assign-only is inference, marked (Question 1).
   Never retroactive: saving rules touches nothing until logins happen.
5. **Organization assignment ships in the same engine**: ordered first-match
   rules per provider plus a default; the hook applies the first match to
   `users.organization_id`; a user matching nothing with no default is
   refused the token — "blocked from logging in", executably. Group rules
   (marking provider groups with orgs) wait with external providers.
6. **A test function is part of the engine**, not the surface:
   `test_group_assignment(user)` answers with matched rules and resulting
   groups without writing anything — the Test rules panel's contract, and
   the probe's own instrument.
7. **The user-directory surface (passkeys, invitations) is not built**:
   GoTrue owns credentials and Supabase's dashboard is its Manage users
   page. Recorded, not wrapped.

## Questions

1. **Does a login REMOVE rule_based membership that no longer matches?** The
   pages say only "assigned". Decision 4 syncs (assign and remove) for the
   provider's own groups, leaning on the legibility sentence; if a page
   later shows accretion-only, one function changes. `blocks: nothing.`
2. **What is the full multipass attribute vocabulary?** The picker shows
   three (`multipass:email:primary`, `multipass:family-name`,
   `multipass:given-name`) plus Provider groups; the SAML how-tos likely
   map more. Ours starts with the three the capture enumerates, sourced to
   it. `blocks: nothing` — conditions store the attribute as text.
3. **Do org-assignment USER rules also admit internal-group conditions?**
   The prose says yes ("attributes, internal groups, or provider groups")
   while recommending against them. Ours starts with attributes only,
   recorded. `blocks: nothing.`
