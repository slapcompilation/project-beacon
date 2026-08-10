// Personal account & preferences — reached from the Topbar account menu.
// Holds the per-user stuff that used to be mixed into Settings: appearance,
// security (2FA), and notification prefs. Settings is now the admin/org console.

import { useAuthStore } from '@/stores/auth.store'
import { AppearanceSection } from '@/features/settings/sections/AppearanceSection'
import { SecuritySection } from '@/features/settings/sections/SecuritySection'

export default function AccountPage() {
  const email = useAuthStore((s) => s.session?.user.email ?? '')
  const role  = useAuthStore((s) => s.role)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-8 py-5 flex-shrink-0">
        <h1 className="text-xl font-semibold">Account</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {email}{role ? ` · ${role.replace(/_/g, ' ')}` : ''}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-2xl space-y-10">
        <AppearanceSection />
        <SecuritySection />
      </div>
    </div>
  )
}
