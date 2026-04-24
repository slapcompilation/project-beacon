import { cn } from '@/lib/utils'
import { LAYER_COLOR } from './constants'

export function LayerDot({ layer }: { layer: string }) {
  return <span className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', LAYER_COLOR[layer] ?? 'bg-gray-400')} />
}
