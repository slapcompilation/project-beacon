// Layer: Floor — Chorded G-key keyboard navigation
// Implements Palantir-style keyboard-first navigation.
// Press G then a second key within 1 second to jump to a route.
// Mirrors the shortcut hints displayed in the CommandBar.

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const G_SHORTCUTS: Record<string, string> = {
  d: '/',
  i: '/inventory',
  s: '/scan',
  a: '/alerts',
  t: '/stocktake',
  r: '/restocks',
}

const CHORD_TIMEOUT_MS = 1000

export function useKeyboardNav() {
  const navigate = useNavigate()
  const waitingForChord = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const clearChord = () => {
      waitingForChord.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs, textareas, contenteditable
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return
      }

      if (waitingForChord.current) {
        const route = G_SHORTCUTS[e.key.toLowerCase()]
        clearChord()
        if (route) {
          e.preventDefault()
          void navigate(route)
        }
        return
      }

      if (e.key.toLowerCase() === 'g') {
        e.preventDefault()
        waitingForChord.current = true
        timeoutRef.current = setTimeout(clearChord, CHORD_TIMEOUT_MS)
      }
    }

    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      clearChord()
    }
  }, [navigate])
}
