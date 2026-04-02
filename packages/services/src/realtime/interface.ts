export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

export interface RealtimePayload<T> {
  eventType: Exclude<RealtimeEvent, '*'>
  new: T | null
  old: T | null
  table: string
}

export interface IRealtimeService {
  /**
   * Subscribe to table changes for the current hotel.
   * Returns an unsubscribe function — always call it on cleanup.
   */
  subscribe<T>(
    table: string,
    event: RealtimeEvent,
    callback: (payload: RealtimePayload<T>) => void,
    filter?: string
  ): () => void

  disconnect(): void
}
