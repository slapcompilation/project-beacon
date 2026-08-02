// Promote a module to the Applications portal.
//
// Foundry requires name, icon, owner, thumbnail and a collection before an app
// can be promoted; tags and description are optional. Everything but the
// thumbnail is required here — see migration 309 for why that one diverges.

import { useState } from 'react'
import {
  Button, Callout, Dialog, DialogBody, DialogFooter, FormGroup, HTMLSelect,
  InputGroup, Intent, TextArea,
} from '@blueprintjs/core'
import { useAuthStore } from '@/stores/auth.store'
import {
  useAppCollections, usePromoteModule, useUnpromote, type PromotedApp,
} from './promotions'
import type { ModuleDoc } from './api'

export function PromoteDialog({ open, onClose, mod, existing }: {
  open: boolean
  onClose: () => void
  mod: ModuleDoc
  existing: PromotedApp | undefined
}) {
  const userId = useAuthStore((s) => s.session?.user.id ?? '')
  const { data: collections = [] } = useAppCollections(open)
  const promote = usePromoteModule()
  const unpromote = useUnpromote()

  const [name, setName] = useState(existing?.name ?? mod.title)
  const [icon, setIcon] = useState(existing?.icon ?? mod.icon)
  const [description, setDescription] = useState(existing?.description ?? mod.description)
  const [tags, setTags] = useState((existing?.tags ?? []).join(', '))
  const [collectionId, setCollectionId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const chosen = collectionId || collections[0]?.id || ''
  const ready = name.trim() !== '' && icon.trim() !== '' && chosen !== ''

  const submit = () => {
    setError(null)
    promote.mutate({
      moduleId: mod.id, moduleVersion: mod.version, collectionId: chosen,
      name: name.trim(), icon: icon.trim(), description: description.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      ownerUserId: userId, hotelId: mod.hotelId,
    }, {
      onSuccess: onClose,
      onError: (e: Error) => { setError(e.message) },
    })
  }

  return (
    <Dialog isOpen={open} onClose={onClose} title={existing ? 'Update publication' : 'Publish to Applications'}
      className="!w-[28rem]">
      <DialogBody>
        <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
          {existing
            ? `The portal currently serves v${existing.publishedVersion}. Publishing again points it at v${mod.version}.`
            : `Publishing lists this application in the portal and pins the version people get — v${mod.version}.`}
        </p>

        {collections.length === 0 ? (
          <Callout intent={Intent.WARNING} icon="folder-close">
            There are no collections yet. A collection is a section of the portal, and
            an application has to live in one — create one before publishing.
          </Callout>
        ) : (
          <div className="space-y-3">
            <FormGroup label="Name *" helperText="What it is called in the portal — it may differ from the module title.">
              <InputGroup value={name} onChange={(e) => { setName(e.target.value) }} />
            </FormGroup>
            <FormGroup label="Collection *" helperText="The section it appears under.">
              <HTMLSelect fill value={chosen}
                onChange={(e) => { setCollectionId(e.currentTarget.value) }}
                options={collections.map((c) => ({ label: c.title, value: c.id }))} />
            </FormGroup>
            <FormGroup label="Icon *" helperText="A Blueprint icon name, e.g. inbox.">
              <InputGroup value={icon} onChange={(e) => { setIcon(e.target.value) }} />
            </FormGroup>
            <FormGroup label="Description" helperText="One line on the card.">
              <TextArea fill rows={2} value={description}
                onChange={(e) => { setDescription(e.target.value) }} />
            </FormGroup>
            <FormGroup label="Tags" helperText="Comma-separated. Tags filter the portal; collections section it.">
              <InputGroup value={tags} onChange={(e) => { setTags(e.target.value) }}
                placeholder="inventory, daily" />
            </FormGroup>
          </div>
        )}

        {error && <Callout intent={Intent.DANGER} icon="error" className="mt-3">{error}</Callout>}
      </DialogBody>
      <DialogFooter actions={
        <>
          {existing && (
            <Button variant="minimal" intent={Intent.DANGER} loading={unpromote.isPending}
              onClick={() => { unpromote.mutate(existing.promotionId, { onSuccess: onClose }) }}>
              Unpublish
            </Button>
          )}
          <Button variant="minimal" onClick={onClose}>Cancel</Button>
          <Button intent={Intent.PRIMARY} disabled={!ready} loading={promote.isPending} onClick={submit}>
            {existing ? `Publish v${mod.version}` : 'Publish'}
          </Button>
        </>
      } />
    </Dialog>
  )
}
