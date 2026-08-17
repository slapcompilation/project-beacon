---
verify: strict
---

# Every API call carries a token — what that means for `anon`

Read 2026-08-18, to settle the logic behind closing the anon-executable
function surface (547's sweep: 54 SECURITY DEFINER functions, 46 after 548).
Read in full: `api/v1/general-overview-authentication`, `slate/applications-types`,
`slate/applications-create`, `slate/public-applications-data-upload`.

The question the sweep left open was not *whether* to revoke but *on what
principle* — which callers a platform function is for, and whether any
unauthenticated surface is legitimate. Foundry answers both, and the answer is
short enough to be the whole design.

## 1. The API has no anonymous surface

> "All APIs use the OAuth 2.0 (OAuth2) protocol for authentication and
> authorization."

> "To authenticate against the API, you must include an API token, generally
> referred to as a bearer token, in each API call."

Each call. There is no endpoint described anywhere in the API section that a
caller without a token can reach. And every token resolves to an identity whose
permissions bound the call:

> "A temporary API token will hold the same permissions as the user who
> generated it."

> "the access granted to the application is the intersection of this scope and
> the existing permissions of the specific user"

The service-account shape is a token too, not an exemption:

> "Client Credentials grant allows an application to act as a service user."

Our substrate's `anon` role is precisely the caller with no token. In Foundry's
model that caller can invoke **nothing**. So the 46 — and the invoker functions
behind them — are not a list to triage; they are one decision applied 46 times.

## 2. Authenticated callers are gated by permissions, not an endpoint list

> "Importantly, a granted scope evaluates only to a set of permissions, not an
> explicit set of Foundry endpoints."

The same page admits that a valid token may reach "underlying service endpoints
not listed in the documentation" — Foundry's gate on an authenticated call is
the permission evaluation inside the service, not an allowlist of reachable
endpoints. That is our shape already: `authenticated` holds EXECUTE broadly and
every function checks `auth_*` / RLS internally. **So this pass does not narrow
`authenticated` at all** — narrowing it into scopes is Developer Console's
application-scopes feature, a different (recorded, unbuilt) thing.

## 3. The one unauthenticated thing in the platform, and how it is bounded

Slate public applications are the only surface Foundry offers to people without
accounts:

> "Public applications allow users without Foundry accounts to submit
> information, upload data, or upload files into Palantir Foundry, subject to
> validation logic and other safety measures."

Every property of that feature is an explicit, confirmed act, never a default.
A dedicated permission to even create one:

> "users require access to the Manage public Slate applications workflow,
> grantable through Control Panel's Organization permissions settings"

Nothing is reachable until published, and publication cannot happen by
accident:

> "The public application must first be published before unauthenticated users
> can view it."

> "public applications cannot be automatically published and the version
> intended for publication needs to be confirmed every time to prevent
> accidental publication"

What the anonymous user gets is bounded:

> "Once published, non-Foundry users have view-only access to the published
> Slate application using the public link."

Uploads ride a dedicated source, and the docs warn that even unpublishing is
not enough:

> "unauthenticated users could still call the public secure-upload data source.
> Deleting the token is important to maintain application security."

So Foundry's rule, stated once: **anonymous reach is zero by default, and any
exception is an explicitly granted, explicitly published, narrowly bounded
surface.**

## 4. What our catalog does instead (ours, not Palantir's)

Probed 2026-08-18 against production. Two mechanisms mint anonymous reach on
every migration, and no one ever wrote either grant:

1. `CREATE FUNCTION` grants EXECUTE to PUBLIC, and `anon` is in PUBLIC.
2. Supabase ships a default ACL (`pg_default_acl`, grantor `postgres`, schema
   `public`) that stamps EXECUTE to `anon`, `authenticated` and `service_role`
   onto every new function — and DML to `anon` onto every new **table**. A
   fresh probe function came back with both doors open:
   `{=X/postgres,postgres=X,anon=X,authenticated=X,service_role=X}`.

This is why 547's lesson — a changed argument list reopens the hole — kept firing:
the hole is re-minted at CREATE time. 528 reopening the indexer was this, not
carelessness. The B-group of the sweep ("anon granted explicitly") was never a
decision anyone made — it is the default ACL's stamp.

## Decisions (mine, not Palantir's, unless quoted)

1. **Revoke anon (and PUBLIC) EXECUTE on all 46 SECURITY DEFINER functions.**
   The citation is §1: a call with no token reaches nothing. `authenticated`
   and `service_role` keep exactly the access they have today — captured
   per-function before the revoke, restated after, nothing widened. The two
   functions where `authenticated` was already revoked (`simulated_dataset_markings`,
   `search_index_payload`) stay revoked.
2. **The same revoke for the 127 non-extension SECURITY INVOKER functions**
   anon can execute. Same citation; they are the same API surface. They run
   with RLS on, but Foundry refuses the tokenless call at the door, not after
   evaluating it.
3. **Extension-owned functions are left alone.** *Inference*: pgvector's
   operators and type machinery are not endpoints — they are the substrate's
   own vocabulary, their ACLs belong to the extension, and revoking PUBLIC on
   them fights extension upgrades for no data-access gain.
4. **The default ACL stops stamping anon and PUBLIC onto new functions**
   (`ALTER DEFAULT PRIVILEGES` for `postgres` in `public`). This is §3's
   principle mechanised: exposure is an explicit confirmed act — "cannot be
   automatically published … confirmed every time" — never a birth-right.
   `authenticated` and `service_role` stay in the default, per §2.
5. **`authenticated` is not narrowed in this pass** (§2). Scope-shaped
   narrowing is recorded as future work, not smuggled in here.
6. **The anon *table* grants are recorded, not built.** The same default ACL
   gives anon DML on every new table (549 closed one instance by hand). The
   same citation covers it, but sweeping ~92 tables' grants deserves its own
   pass with its own assertions, after this one lands.

## Built (2026-08-18) — migrations 550–552

Decisions 1–4 shipped as recited (550: the 46; 551: the 127 invoker functions
and both default-ACL arms for functions — with the live-verified trap that the
per-schema form ADDS to built-in defaults, so removing the PUBLIC grant needed
the global form). Decision 6 followed as 552 once the blast radius was probed:
all 92 anon-granted tables were RLS-guarded, no policy named anon, no relation
carried a PUBLIC grant, and no migration had ever granted a table to anon
deliberately — every grant was the stamp. 552 revokes anon from every relation
and sequence we own in public and turns off the table/sequence stamp for new
ones. `authenticated` and `service_role` untouched throughout, per decision 5.

The standing invariant lives in `packages/platform/src/anonSurface.test.ts`:
nothing we own in `public` — function, relation or sequence — is reachable by
anon, and objects born today carry no anon stamp. The reachability guard now
takes edge-function sources as caller evidence instead of the anon grant that
turned out to be the bug itself.

## Questions

1. Will we ever need a public-application equivalent (an unauthenticated
   surface)? If so, §3 is the shape: a dedicated permission, an explicit
   publish step with confirmation, view-only reach, and a kill switch that
   actually kills. Nothing today needs it.
2. Should `authenticated`'s broad EXECUTE eventually narrow into per-application
   scopes ("the Ontologies API documentation specifies the api:ontologies-read
   scope for reads")? Recorded; nothing forces it yet, and the generated
   client's grant-derived scope would be where it lands.
