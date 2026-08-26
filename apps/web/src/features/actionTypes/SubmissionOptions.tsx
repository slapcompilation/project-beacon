// Submission options — the Form tab's second card, drawn as
// action-reverts-form-button.png draws it: a titled card of labelled
// switches, each with a subtitle.
//
// "In the **Form** tab of an action, toggle on the **Allow revert after
// action submission** button" — action-types/action-reverts.
//
// The capture's card holds three rows. Two of them, Customize submit button
// and Customize success message, are NOT built: nothing here stores a custom
// submit label or success message, and a switch over a thing that does not
// exist is an inert control. Recorded rather than drawn dead.

import { Card, Switch } from '@blueprintjs/core'
import { useAllowRevert, useSetAllowRevert } from '@/features/actionTypes/criteria'

export function SubmissionOptions({ actionTypeId }: { actionTypeId: string }) {
  const { data: allowed, isLoading } = useAllowRevert(actionTypeId)
  const set = useSetAllowRevert(actionTypeId)
  if (isLoading) return null

  return (
    <div className="oma-config mt-3">
      <h3 className="text-sm font-semibold">Submission options</h3>
      <Card compact className="mt-2 flex items-center gap-2">
        <span className="flex-1">
          <span className="text-xs block">Allow revert after action submission</span>
          <span className="text-xs text-muted-foreground block">
            Directly after clicking submit button on an action, display option to revert.
          </span>
        </span>
        <Switch checked={allowed ?? true} className="mb-0"
          onChange={(e) => { set.mutate(e.currentTarget.checked) }} />
      </Card>
      <p className="text-xs text-muted-foreground mt-1">
        {allowed === false
          ? 'Turning this off also revoked the revert on submissions already made; turning it back on does not restore them.'
          : 'The success toast is the only opportunity to revert, and only for the user who applied it.'}
      </p>
    </div>
  )
}
