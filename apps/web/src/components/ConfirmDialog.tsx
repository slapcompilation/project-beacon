// Reusable confirm modal. Replaces window.confirm() everywhere.

import { Button, Dialog, DialogBody, DialogFooter, Intent } from '@blueprintjs/core'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button when true. */
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  destructive  = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog isOpen={open} onClose={onCancel} title={title} className="!w-[24rem]">
      {description && (
        <DialogBody>
          <p className="text-sm text-muted-foreground">{description}</p>
        </DialogBody>
      )}
      <DialogFooter
        actions={
          <>
            <Button variant="minimal" onClick={onCancel}>{cancelLabel}</Button>
            <Button
              intent={destructive ? Intent.DANGER : Intent.PRIMARY}
              onClick={() => { onConfirm(); onCancel() }}
            >
              {confirmLabel}
            </Button>
          </>
        }
      />
    </Dialog>
  )
}
