// Helpers for the Settings sections. `SectionHeader` is used by both of them;
// `SettingRow` is used by NEITHER — `unwired-exports.mjs` counts it, and it is
// kept rather than deleted because the sections that would use a label/control
// row are the Control Panel tabs the surface map records as absent (§3.9). It
// is a leftover the moment that stops being true.

export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
    </div>
  )
}

export function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}
