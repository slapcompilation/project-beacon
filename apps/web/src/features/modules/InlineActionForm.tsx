// Inline Action widget (G3). Foundry: "Action forms trigger one Action at a
// time and are recommended for small-scale datasets where guided form
// interaction is desired."
//
// CAPABILITY-CHAIN called this "presentation, not capability — it is
// ActionFormModal without the Dialog", and that is exactly what it is: the same
// component with `chrome="inline"`. One validation path, one dispatch, one audit
// entry. A second implementation of this form is the last thing the Action
// Registry needs.

import { Callout, Intent } from '@blueprintjs/core'
import type { BeaconAction } from '@beacon/reality-graph'
import { ActionFormModal } from '@/features/actions/ActionFormModal'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'

export function InlineActionForm({
  actionType, title, defaults, onDone,
}: {
  actionType: string
  title?: string
  /** Preset field values from the widget config. */
  defaults?: unknown
  onDone: () => void
}) {
  const hotelId = useActiveHotelId()
  const actorId = useAuthStore((s) => s.session?.user.id ?? null)

  if (!hotelId) {
    return (
      <Callout intent={Intent.WARNING} icon="warning-sign" className="text-xs">
        Pick a property before using this form — an action is always written against one.
      </Callout>
    )
  }

  return (
    <ActionFormModal
      chrome="inline"
      open
      onClose={onDone}
      actionType={actionType as BeaconAction['type']}
      context={{ hotelId }}
      initialValues={defaults && typeof defaults === 'object' ? defaults as Record<string, unknown> : undefined}
      titleOverride={title}
      dispatchContext={{ hotelId, actorId, triggeredBy: 'user' }}
      onSuccess={onDone}
    />
  )
}
