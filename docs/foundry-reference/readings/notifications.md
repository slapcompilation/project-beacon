---
verify: strict
---

# Notifications — one type, four audiences, and a preference centre

**Pages read in full: 10.** `action-types/notifications`,
`data-health/notifications`, `health-checks/notifications`,
`object-monitors/notifications`, `upgrade-assistant/notifications`,
`automate/effect-notification`, `automate/notification-settings`,
`automate/automation-administrators`, `automate/limits`, and
`functions/configure-notifications` — plus the `### Notification` section of
`functions/types-reference`, which is where the type is actually defined and
which nothing routed me to.

**Images, counted rather than asserted:** those pages reference **34** distinct
images. **32 were parsed here**, and the remaining two —
`automate/images/effect-fallback-configuration.png` and
`automate/images/effect-fallback-error-info.png` — were parsed for
`readings/automate-effect-inputs.md`, which shares the fallback page. So nothing
is unparsed across the pair, and the split is stated rather than rounded off.

**There is no `notifications` section in the mirror.** That is the fact this
reading starts from, and the thing it exists to settle: whether the five product
pages describe one mechanism or five.

---

## 1. The answer: one type, and it is published

Not a convention drawn across five pages — a type, defined in `functions/`:

> * A `Notification` consists of two fields: a `ShortNotification` and `EmailNotificationContent`.

— functions/types-reference.md

> * A `ShortNotification` represents a summarized version of the notification, which will be shown within the Foundry platform. It includes a short `heading`, `content`, and a collection of `Link`s.

— functions/types-reference.md

> * `EmailNotificationContent` represents a rich version of the notification which can be sent externally via email. It includes a `subject`, a `body` consisting of headless HTML, and a collection of `Link`s.

— functions/types-reference.md

> * A `Link` has a user-facing `label` and a `linkTarget`. The `LinkTarget` can be a URL, an `OntologyObject`, or a `rid` of any resource within Foundry.

— functions/types-reference.md

Four sentences give the whole payload: one notification, two renderings, and a
link list whose target is a URL, an object, or any resource RID. Every product
page below is a way of populating it.

**Two field vocabularies for the same authored content**, which is this
repository's known live trap and appears here in its purest form. The in-platform
half is `heading` and `content`; the email half is `subject` and `body`. The
Functions SDK adds a generation split on top: v1 names the two halves
`ShortNotification` and `EmailNotificationContent`, while v2 and Python name them
`platformNotification` and `emailNotification`. A column has to pick an audience
and say which.

## 2. Four audience models, one delivery model

This is the design, and it is the part a single table would get wrong.

| product | who receives it |
|---|---|
| Action types | recipients configured on the notification itself |
| Data health | the watchers of a check |
| Object monitors | subscribers, in a three-tier membership |
| Upgrade assistant | computed from resource assignment plus a role |

So *who* is per product and resolved by the producer. *How* is uniform: the
recipient's own preference decides the channel. Anything we build separates those
two questions or it will grow a fifth audience model per producer.

Two rules constrain every producer:

> Sending directly to email addresses is not supported.

— action-types/notifications.md

> Groups will be resolved to individual users in order to check permissions on the data before sending the notifications.

— action-types/notifications.md

A recipient is a Foundry principal — a user or a group — never a free-text
address, and a group is expanded to users **so that permissions can be checked per
person**. That expansion is not a convenience; it is what makes the next rule
enforceable.

## 3. Delivery is permission-checked per recipient, on the content

> Users may only receive notifications containing data which they are allowed to view.

— action-types/notifications.md

The page gives two named behaviours for what happens when a recipient may not see
the data: require **all** users to have permissions, in which case the whole
action fails and nothing is edited and nothing is sent; or require **any**, in
which case it succeeds and only the permitted recipients are notified. That is a
rule about rendered content, not about a row, and it means a notification cannot
be composed once and fanned out blindly.

And the content is rendered against the ontology *before* the edit that triggered
it:

> Any Ontology data used for generating notification content will reflect the state of the Ontology before edits of the current Action are applied.

— action-types/notifications.md

The documented answer is to link to the object rather than interpolate its new
values. A clone that renders from post-edit state diverges from the page, and
would do so invisibly.

## 4. What the limits actually are, and what they do

> * The maximum subject length is 250 characters.

— action-types/notifications.md

Body is 1,000 characters, and 51,200 when the email carries custom HTML.
Recipients cap at 50 when the content comes from a function and 500 when it comes
from a template. `automate/limits` adds a per-automation ceiling of 10,000
recipients.

**The enforcement is not uniform, and that decides the rung.** The recipient caps
*fail* the action. The length caps are validated and truncated at render time with
a trailing ellipsis. So a length CHECK that refused a long body at save would be
stricter than Foundry; truncation belongs in the renderer.

## 5. What the first pass got wrong, and how

Recorded because the corrections are more useful than the claims.

**The channel set is not closed at email and web.** The preference matrix in the
settings capture shows those two per row, with desktop as a global toggle, and I
took that for the whole set. `object-monitors/overview` **enumerates** the
mechanisms and it wins over a screenshot of one page:

> Notifications may be sent via:

— object-monitors/overview.md

Three follow: the in-platform pop-up, email, and **SMS through a webhook to a
third-party service**. The third is a real delivery path the preference matrix
never shows.

**The notification centre is described in prose, and I said it was not.**

> * In-platform pop-up in the Foundry notifications center

— object-monitors/overview.md

The claim that only images describe it was a claim of absence, which is the
dangerous kind, and it was wrong by one sentence on a page one link above the one
I was reading. Mine.

**Object Monitors are sunset.** Its overview opens by saying so and names the
replacement:

> We recommend migrating your workflows to

— object-monitors/overview.md

The link goes to Automate. So the subscriber model above is a *sunset* product's
audience model, and building it would be the fourth deprecated design in a
repository whose deprecation audit exists because one got in. Its notification
page still counts as evidence for the shared payload — that is a fact about the
type, not about the product.

**A preference-centre capture calls itself experimental**, in its own visible
copy, and the first pass transcribed that sentence and then dropped it from every
finding.

**Two of the five pages are one page.** `data-health/notifications` and
`health-checks/notifications` are byte-identical apart from the mirrored source
line, and their images are identical pairs. I confirmed it with a diff. So the
five-page corpus is four pages, and one of the four is a sunset product.

## 6. A per-automation dimension does exist

The first pass concluded preferences are only per-user and global, and that a
per-automation control would be inventing a mechanism. A 21-line page refutes it:

> By default, the automation owner and all recipients of notification effects receive automation warnings and error notifications

— automate/automation-administrators.md

It enumerates two notification classes — automation information, and effect
failure — and carries a rule that bounds the second:

> Effects are always executed per user and a user can only receive effect failure notifications for themselves.

— automate/automation-administrators.md

So restricting effect-failure notifications to administrators does not redirect
them; it suppresses them for everyone else. That is a real constraint on any
per-automation setting.

## 7. Issues are not a notification

Data health can file an issue on failure and close it when the check resolves.
The capture shows a tracked entity with a title, comments, an assignee, labels, a
priority, a due date, an open or closed pill and a watcher count. A notification
has none of that lifecycle. If both are ever built they are separate tables, and
conflating them would produce a notification row that needs to be updated.

## Connects to

- **Three producers here already point at this and find nothing.** 517 registers
  an automation effect kind whose comment says no notification system exists; 659
  says health-check watchers become the audience if one ever does; 661 says snooze
  only silences notifications; 418 records notification as one of three side-effect
  rules. The audience side is modelled in four places and the delivery side in
  none, which is the shape the standing rule asks for before building.
- `readings/automate-effect-inputs.md` — the notification effect is one of
  Automate's four effect kinds, and its recipients can come from an effect input.
- `readings/data-health.md` and the monitoring reading, for the two watcher and
  subscriber audiences.

## 8. What building it found (793, 794)

Three things, none of them visible from the pages.

**A deferred guard fired against a row that no longer existed.**
`guard_sequential_needs_two` is a deferred constraint trigger, so it runs at
commit. Create an automation and delete it inside one transaction, and the check
fires after the row has gone, its lookup of the execution mode returns null,
`null <> 'sequential'` is neither true nor false, control falls past the early
return, and the count is now zero — so a transaction that leaves no automation at
all is refused for having too few effects on one. Same shape as the decimal with
no precision that rode through a validator in 391, and the same shape as this
build's own first validator, which let a notification with no recipients through
because the type of a missing key is null rather than a mismatch. Fixed in 794: a
guard has nothing to protect once its subject is deleted.

**An automation carries no resource identifier**, so a notification it produces
cannot name its producer. Migration 488 gave identifiers to link types, shared
properties, action types and value types on eight attested pages; no page attests
one for an automation, and inventing a token to fill a column is the wrong-token
risk 396 exists to warn about. The column stays null, and 794 carries an
assertion that fails the day an automation gains one, so the decision is
revisited rather than forgotten.

**The recipient rule that is enforceable is not the one the reading led with.**
The content-level rule — users may only receive notifications containing data
they are allowed to view — has nothing to bite on while nothing interpolates
ontology data into a body. The effect page carries a different one that does:
a recipient needs at least Viewer on the automation. That is about a resource we
own, so 794 enforces it, and a recipient who fails it is dropped rather than
failing the effect.

## Decisions (2026-09-10 — NOT YET READ BY A HUMAN)

1. **Build one notification payload**, shaped as the published type: a heading and
   content for in-platform, a subject and body for email, and a shared link list
   whose target is a URL, an object, or a resource RID.
2. **Vocabulary: the payload takes the api's field names**, because the type is
   published in `functions/` and every producer renders into it. The v1 spelling
   is the one the type reference prints.
3. **Audience stays with the producer.** No shared recipients table. Each
   producer resolves principals its own way and hands the delivery layer a list.
4. **Groups expand to users before delivery**, because the permission check is
   per person and the page makes the expansion its reason.
5. **Do not build the object-monitor subscriber branch.** Sunset, with Automate
   named as the replacement.
6. **Length caps truncate at render; recipient caps refuse.** Matching the two
   enforcement behaviours the page states, rather than making both CHECKs.
7. **Channels are an enumeration from `object-monitors/overview`** — in-platform,
   email, SMS by webhook — and only the first is buildable here, because we have
   no mail transport and no webhooks. The other two are stored as declared and
   unimplemented rather than left out of the set.

## Questions

1. **Where does the org-level redaction switch live?** The action page names
   Control Panel and links to `email/email-content-redaction`, and the whole
   `email/` section is absent from the mirror.
2. **Is the preference centre one page or per product?** Three products route to
   the same settings page, but the capture that shows it whole belongs to data
   health, and its own copy calls the feature experimental.
3. **Does a notification carry attachments?** The effect page mentions an
   attachment failing to render, and no page read here defines one.
