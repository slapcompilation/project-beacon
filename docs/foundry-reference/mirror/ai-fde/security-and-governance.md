<!-- source: https://palantir.com/docs/foundry/ai-fde/security-and-governance/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Security and governance

Security and governance are built into AI FDE, since it operates entirely under your identity and permissions. AI FDE is not a separate service account or bot; it acts on your behalf using your existing Foundry session. Every action it takes is subject to the same permission checks, governance controls, and audit logging as any manual action you perform in Foundry.

## Scoped to your permissions

When you use AI FDE, all operations are executed using your authenticated Foundry session. There is no separate credential, service account, or escalated privilege involved.

AI FDE operates under the same permission constraints as your user account:

* If you do not have permission to create a repository, neither does AI FDE.
* If you cannot edit an object type or execute an action, neither can AI FDE.
* Permission errors are identical to what you would see if you performed the same operation manually.

This applies to all capabilities, including OSDK application creation, ontology edits, dataset builds, and code repository operations.

## User approval for sensitive actions

Beyond server-side permission enforcement, AI FDE implements a tool approval system that requires explicit user confirmation before executing mutating operations. Defaults are maximally conservative; nothing that could impact production workflows is auto-approved. You can also approve specific tools for the duration of a session, scoped to a branch or project where relevant.

| Category | Examples |
| --- | --- |
| Requires approval every time | Executing ontology actions, creating applications or widgets, publishing, or creating tags. |
| Branch-aware approval | File edits and dataset builds auto-approve on feature branches, but require approval on protected branches. |
| Auto-approved | Read-only operations such as searching and reading definitions. |

You remain in control of what the agent does. AI FDE cannot perform write operations without your consent, whether consent is given per-action or granted upfront for the session.

## Session access and security

Each AI FDE session is only accessible to the user who created it. Sessions cannot be shared with or accessed by other users.

When a new session is created, the markings you have access to are applied to that session. If you lose access to a marking that was applied to a session, access to the session will be lost. Regaining access to the marking will restore access to the session.

## Audit logging and attribution

All activity is fully auditable through standard Foundry audit logs. Because every API call carries your identity, Foundry's platform-level audit logging captures all operations attributed to you, exactly as it would for manual actions. This includes repository operations, ontology changes, dataset builds, and all other platform interactions.

LLM usage is also attributed to your individual user identity, ensuring that usage tracking and rate limiting apply per user.

## Key takeaways

| Control | Description |
| --- | --- |
| Identity | All actions are performed on your behalf using your credentials. There is no service account or separate identity. |
| Permissions | Standard Foundry permissions are enforced server-side on every operation. |
| User approval | Mutating actions require user consent, either confirmed per-action or through session-level pre-approval scoped to a branch or project. |
| Session access | Sessions are only accessible to user who created it and secured by the user's markings. |
| Audit trail | Logging through both AI FDE session logs and standard Foundry audit logs are fully in effect. |
| LLM attribution | Model usage is tracked to your individual account. |
| Governance | Existing Foundry governance including permissions, branching controls, and audits apply without exception. |

AI FDE is a productivity tool within your existing Foundry session and **cannot** exceed your permissions. All actions are logged under your identity, and the standard governance model applies in full effect.
