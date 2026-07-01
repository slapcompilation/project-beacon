// Preview surface for the AIP visual-parity work (docs/AIP-UX-RESTRUCTURE.md).
// Renders FoundrySidebar next to a placeholder content area so the sidebar can
// be calibrated against the Foundry reference screenshots WITHOUT touching the
// live global nav. Route: /ux/sidebar. Delete once the shell ships.

import { useState } from 'react'
import { FoundrySidebar } from '@/features/foundryShell/FoundrySidebar'

export default function FoundryShellPreview() {
  const [active, setActive] = useState('home')
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <FoundrySidebar activeId={active} onSelect={setActive} />
      <main className="flex-1 overflow-auto bg-[#f1f3f7] p-8">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Parity preview</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#1a1f25]">Foundry sidebar — Phase 1</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Calibrating against <code>docs/aip-reference/</code>. Selected: <b>{active}</b>. Toggle collapse
          from the header icon. This preview is isolated — the live nav is untouched.
        </p>
      </main>
    </div>
  )
}
