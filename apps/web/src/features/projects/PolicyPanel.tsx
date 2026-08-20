// The project's approval policy, which 462 stored and enforced and nothing has
// ever shown. readings/branch-overlay.md records it as a leftover — "Policies
// rendered" — with the sentences verbatim, and this is that leftover.
//
// The policy is rendered as a SENTENCE, because that is how Foundry prints it:
// "Approval required from at least one user with edit permissions to the file."
// for the default, and a composed one for a custom policy. The controls sit
// under the sentence rather than replacing it.
import { useState } from 'react'
import { Button, Card, HTMLSelect, Icon, Switch, Tag } from '@blueprintjs/core'
import type { Project, ProjectMember } from '@/features/projects/api'
import { useSetProjectPolicy } from '@/features/projects/api'

/** "Approval policies have three customizable parameters: Eligible reviewers…
 *  Number of approvals required… Contributor approval". A policy is custom once
 *  a count is set; NULL is the default policy. */
function policySentence(p: Project, reviewerNames: string[]): string {
  if (p.policyApprovalsRequired === null) {
    return 'Approval required from at least one user with edit permissions to the file.'
  }
  const who = reviewerNames.length > 0 ? reviewerNames.join(', ') : 'no eligible reviewers yet'
  const base = `Approval required from at least ${String(p.policyApprovalsRequired)} `
    + `${p.policyApprovalsRequired === 1 ? 'user' : 'users'} in the following: ${who}`
  return p.policyContributorApproval
    ? `${base}.`
    : `${base} AND Reviewers cannot approve changes to files they have contributed to in the proposed branch.`
}

export function PolicyPanel(
  { project, members, canEdit }:
  { project: Project; members: ProjectMember[]; canEdit: boolean },
) {
  const set = useSetProjectPolicy(project.id)
  const [adding, setAdding] = useState('')
  // "Reviewer GROUPS are out of scope (we have no user groups); reviewer lists
  // hold users" — 462. A grant row is a user OR a group, never both.
  const users = members.flatMap((m) => m.userId !== null ? [{ id: m.userId, label: m.label ?? m.userId }] : [])
  const nameOf = (id: string) => users.find((u) => u.id === id)?.label ?? id.slice(0, 8)
  const reviewerNames = project.policyReviewerIds.map(nameOf)
  const isCustom = project.policyApprovalsRequired !== null

  return (
    <Card compact className="!p-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Icon icon="shield" size={12} className="text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Approval policy
        </span>
        <Tag minimal className="!text-[9px]">{isCustom ? 'Custom' : 'Default'}</Tag>
        {isCustom && canEdit && (
          <Button variant="minimal" size="small" className="ml-auto !text-[10px]"
            onClick={() => {
              set.mutate({ policyApprovalsRequired: null, policyReviewerIds: [], policyContributorApproval: true })
            }}>Reset policy to default…</Button>
        )}
      </div>

      <p className="px-3 py-3 text-xs">{policySentence(project, reviewerNames)}</p>

      {canEdit && (
        <div className="px-3 pb-3 space-y-2 border-t border-border pt-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Approvals required</span>
            <HTMLSelect value={project.policyApprovalsRequired ?? ''}
              onChange={(e) => {
                const v = e.currentTarget.value
                set.mutate({ policyApprovalsRequired: v === '' ? null : Number(v) })
              }}>
              <option value="">Default policy</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </HTMLSelect>
          </div>

          {isCustom && (
            <>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-muted-foreground">Eligible reviewers</span>
                {project.policyReviewerIds.map((id) => (
                  <Tag key={id} minimal onRemove={() => {
                    set.mutate({ policyReviewerIds: project.policyReviewerIds.filter((r) => r !== id) })
                  }}>{nameOf(id)}</Tag>
                ))}
                <HTMLSelect value={adding} onChange={(e) => {
                  const id = e.currentTarget.value
                  setAdding('')
                  if (id !== '') set.mutate({ policyReviewerIds: [...project.policyReviewerIds, id] })
                }}>
                  <option value="">Add…</option>
                  {users.filter((u) => !project.policyReviewerIds.includes(u.id))
                    .map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                </HTMLSelect>
              </div>
              {/* "A contributor is any user who has made a change to that
                  resource on the branch." */}
              <Switch checked={!project.policyContributorApproval} className="!text-xs !mb-0"
                label="Reviewers cannot approve changes to files they have contributed to"
                onChange={(e) => {
                  set.mutate({ policyContributorApproval: !e.currentTarget.checked })
                }} />
            </>
          )}

          {/* "When toggled on, this setting will automatically protect all new
              files created in the project." */}
          <Switch checked={project.autoProtectNew} className="!text-xs !mb-0"
            label="Automatically protect all new files"
            onChange={(e) => { set.mutate({ autoProtectNew: e.currentTarget.checked }) }} />
        </div>
      )}
      {!canEdit && (
        <p className="px-3 pb-3 text-[11px] text-muted-foreground">
          Only users that are owners on the project can update its custom policy.
        </p>
      )}
    </Card>
  )
}
