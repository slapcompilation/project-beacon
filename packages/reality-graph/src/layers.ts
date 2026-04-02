// Reality Graph — Layer definitions
// The four permanent layers of the hotel operating system.

export type Layer = 'floor' | 'flow' | 'eye' | 'mind'

export interface LayerMeta {
  id: Layer
  label: string
  description: string
}

export const LAYERS: Record<Layer, LayerMeta> = {
  floor: {
    id: 'floor',
    label: 'Floor',
    description: 'Physical reality — scanning, voice, quick adjustments',
  },
  flow: {
    id: 'flow',
    label: 'Flow',
    description: 'Operational movement — receive, store, use, restock; immutable logs, undo',
  },
  eye: {
    id: 'eye',
    label: 'Eye',
    description: 'Intelligence — waste radar, predictive restocking, smart alerts',
  },
  mind: {
    id: 'mind',
    label: 'Mind',
    description: 'Strategy & memory — chain benchmarking, procurement leverage, invoicing intelligence',
  },
}
