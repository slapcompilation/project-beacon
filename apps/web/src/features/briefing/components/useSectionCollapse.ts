import { useState } from 'react'

export function useSectionCollapse(sectionId: string, defaultOpen: boolean): [boolean, (v: boolean) => void] {
  const key = `briefing-section-${sectionId}`
  const [open, setOpenState] = useState(() => {
    const stored = localStorage.getItem(key)
    return stored !== null ? stored === '1' : defaultOpen
  })
  const setOpen = (v: boolean) => {
    setOpenState(v)
    localStorage.setItem(key, v ? '1' : '0')
  }
  return [open, setOpen]
}
