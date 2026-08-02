// Which properties run this application, and which are behind.
//
// The org-wide half of W5's exit criterion: a workflow authored at Valinor runs
// at Rivendell, AND the org can see who has adopted it.

import { Button, Card, Icon, Intent, Tag } from '@blueprintjs/core'
import {
  useForkInstallation, useInstallModule, useModuleAdoption, useUninstallModule,
} from './installations'
import type { ModuleDoc } from './api'

export function AdoptionPanel({ mod }: { mod: ModuleDoc }) {
  const { data: rows = [], isLoading } = useModuleAdoption(mod.id)
  const install   = useInstallModule(mod.id)
  const uninstall = useUninstallModule(mod.id)
  const fork      = useForkInstallation(mod.id)

  // An org-wide module already runs everywhere; installing it would be a
  // no-op that makes the adoption count lie.
  if (mod.hotelId === null) {
    return (
      <Card className="text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Icon icon="globe" size={12} />
          This application is org-wide — every property already runs it. Adoption
          applies to applications authored at one property.
        </div>
      </Card>
    )
  }

  if (isLoading || rows.length === 0) return null

  const adopted = rows.filter((r) => r.installed && !r.isAuthor).length
  const others  = rows.filter((r) => !r.isAuthor)

  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Adoption
        </div>
        <span className="text-[11px] text-muted-foreground">
          {adopted} of {others.length} other {others.length === 1 ? 'property' : 'properties'}
        </span>
      </div>

      <div className="divide-y divide-border/40">
        {rows.map((r) => {
          const behind = r.installed && !r.forked && (r.installedVersion ?? 0) < r.sourceVersion
          return (
            <div key={r.hotelId} className="flex items-center gap-2 py-1.5">
              <span className="text-sm flex-1">{r.hotelName}</span>

              {r.isAuthor ? (
                <Tag minimal icon="home">authored here</Tag>
              ) : r.forked ? (
                <Tag minimal icon="fork" intent={Intent.WARNING}>forked — no upgrades</Tag>
              ) : r.installed ? (
                <>
                  <Tag minimal intent={behind ? Intent.WARNING : Intent.SUCCESS}>
                    v{r.installedVersion}{behind ? ` · v${r.sourceVersion} available` : ''}
                  </Tag>
                  {behind && (
                    <Button size="small" variant="minimal" text="Upgrade"
                      loading={install.isPending}
                      onClick={() => { install.mutate({ hotelId: r.hotelId, version: r.sourceVersion }) }} />
                  )}
                  <Button size="small" variant="minimal" text="Fork" loading={fork.isPending}
                    onClick={() => { fork.mutate(r.hotelId) }} />
                  <Button size="small" variant="minimal" icon="cross" aria-label="Uninstall"
                    title={`Remove from ${r.hotelName}`} loading={uninstall.isPending}
                    onClick={() => { uninstall.mutate(r.hotelId) }} />
                </>
              ) : (
                <Button size="small" variant="minimal" text="Install" icon="add"
                  loading={install.isPending}
                  onClick={() => { install.mutate({ hotelId: r.hotelId, version: mod.version }) }} />
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-muted-foreground leading-snug">
        An installation pins the version a property runs — it does not follow this
        one on its own. Forking gives the property its own copy and ends upgrades.
      </p>
    </Card>
  )
}
