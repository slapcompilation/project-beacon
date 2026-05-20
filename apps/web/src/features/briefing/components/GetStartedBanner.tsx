import { useNavigate } from 'react-router-dom'
import { Button, Icon } from '@blueprintjs/core'
import { useProducts } from '@/features/inventory/hooks'

export function GetStartedBanner() {
  const navigate = useNavigate()
  const { data: products = [], isLoading } = useProducts()

  if (isLoading || products.length > 0) return null

  return (
    <div className="rounded-lg border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 px-5 py-4 flex items-start gap-4">
      <div className="h-9 w-9 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center shrink-0">
        <Icon icon="predictive-analysis" size={20} className="text-indigo-600 dark:text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
          Welcome — let's set up your hotel
        </p>
        <p className="text-xs text-indigo-700/70 dark:text-indigo-400/70 mt-0.5 leading-relaxed">
          No products yet. Run the setup wizard to import your inventory, add your first supplier, and set par levels.
          Takes about 5 minutes.
        </p>
      </div>
      <Button
        size="small"
        onClick={() => { void navigate('/setup') }}
        className="!shrink-0 !bg-indigo-600 hover:!bg-indigo-700 !text-white"
      >
        Get started →
      </Button>
    </div>
  )
}
