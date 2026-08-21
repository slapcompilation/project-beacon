// Frontend consumers — the second card on the Security & Submission Criteria
// tab, drawn as effect-actions-submittable-by-automate.png draws it: a titled
// card holding one labelled switch per consumer.
//
// "Not all actions are appropriate to use with Automate. You can disable an
// action from being usable in Automate" — automate/effect-actions.
//
// Foundry's card is a SET: object-monitors/actions describes the same section
// with "Allow An Object Monitor To Submit This Action". Automate is the only
// consumer here, so the card holds one row and says so rather than pretending
// the section is complete.
import { Card, Switch } from '@blueprintjs/core'
import { useAutomateCanSubmit, useSetAutomateCanSubmit } from '@/features/actionTypes/criteria'

export function FrontendConsumers({ actionTypeId }: { actionTypeId: string }) {
  const { data: allowed, isLoading } = useAutomateCanSubmit(actionTypeId)
  const set = useSetAutomateCanSubmit(actionTypeId)
  if (isLoading) return null

  return (
    <div className="oma-config mt-3">
      <h3 className="text-sm font-semibold">Frontend consumers</h3>
      <Card compact className="mt-2 flex items-center gap-2">
        <span className="text-xs flex-1">Allow Foundry Automate to submit this action</span>
        <Switch checked={allowed ?? true} className="mb-0"
          onChange={(e) => { set.mutate(e.currentTarget.checked) }} />
      </Card>
      <p className="text-xs text-muted-foreground mt-1">
        {allowed === false
          ? 'An automation effect naming this action is refused when it is authored, and again if the toggle is turned off after one exists.'
          : 'Automate may submit this action. Turning this off does not affect anyone submitting it by hand.'}
      </p>
    </div>
  )
}
