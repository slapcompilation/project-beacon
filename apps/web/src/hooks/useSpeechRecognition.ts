// Layer: Floor — Web Speech API wrapper for hands-free stock adjustments
// Parses voice commands of the form "adjust [product] by [number] [reason]"

import { useState, useEffect, useRef, useCallback } from 'react'

export interface ParsedCommand {
  productQuery: string   // e.g. "pilsner" — used to filter the product list
  delta: number          // e.g. -3
  reason: string         // e.g. "spillage"
}

// Known write-off category keywords — matched at the end of write-off commands.
const WRITEOFF_KEYWORDS = ['spillage', 'breakage', 'theft', 'spoilage', 'damage', 'waste', 'expired', 'broken']

/**
 * Splits a string of the form "[product] [reason?]" using known write-off keywords
 * as the boundary between product name and reason.
 */
function splitProductAndReason(tail: string, defaultReason: string): { productQuery: string; reason: string } {
  const words = tail.trim().split(/\s+/)
  const idx = words.findIndex((w) => WRITEOFF_KEYWORDS.includes(w.toLowerCase()))
  if (idx > 0) {
    return { productQuery: words.slice(0, idx).join(' '), reason: words[idx] }
  }
  // No known keyword — entire tail is the product query
  return { productQuery: tail.trim(), reason: defaultReason }
}

/** Attempts to parse a voice transcript into a stock adjustment command. */
export function parseVoiceCommand(transcript: string): ParsedCommand | null {
  const normalised = transcript.toLowerCase().trim()

  // Tertiary (write-off vocabulary): "write off N product [reason]", "waste N product [reason]"
  // e.g. "write off 3 Hendricks spillage", "waste 2 pilsner"
  const writeoff = /^(?:write\s+off|waste|remove|spoil|broke)\s+(\d+)\s+(.+)/i.exec(normalised)
  if (writeoff) {
    const { productQuery, reason } = splitProductAndReason(writeoff[2], 'Write-off')
    return { productQuery, delta: -parseInt(writeoff[1], 10), reason }
  }

  // Primary pattern: "adjust X by -N reason" or "adjust X by N reason"
  const primary = /adjust\s+(.+?)\s+by\s+([+-]?\d+)\s*(.*)/i.exec(normalised)
  if (primary) {
    return {
      productQuery: primary[1].trim(),
      delta: parseInt(primary[2], 10),
      reason: primary[3].trim() || 'Voice adjustment',
    }
  }

  // Secondary: "X minus N reason" or "X plus N reason"
  const secondary = /^(.+?)\s+(minus|plus|\+|-)\s*(\d+)\s*(.*)/i.exec(normalised)
  if (secondary) {
    const sign = secondary[2] === 'minus' || secondary[2] === '-' ? -1 : 1
    return {
      productQuery: secondary[1].trim(),
      delta: sign * parseInt(secondary[3], 10),
      reason: secondary[4].trim() || 'Voice adjustment',
    }
  }

  return null
}

export interface SpeechState {
  listening: boolean
  transcript: string
  error: string | null
  supported: boolean
}

interface UseSpeechRecognitionReturn extends SpeechState {
  start: () => void
  stop: () => void
  reset: () => void
}

// ─── Web Speech API types (not in TypeScript's standard DOM lib) ──────────────

interface SpeechRecognitionResultItem {
  transcript: string
  confidence: number
}
interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  [index: number]: SpeechRecognitionResultItem
}
interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const supported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition ?? window.webkitSpeechRecognition)

  const [state, setState] = useState<SpeechState>({
    listening: false,
    transcript: '',
    error: null,
    supported,
  })

  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    if (!supported) return

    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return

    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1]
      if (result.isFinal) {
        const text = result[0].transcript
        setState((s) => ({ ...s, transcript: text, listening: false }))
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setState((s) => ({ ...s, error: event.error, listening: false }))
    }

    recognition.onend = () => {
      setState((s) => ({ ...s, listening: false }))
    }

    recognitionRef.current = recognition

    return () => {
      recognition.abort()
    }
  }, [supported])

  const start = useCallback(() => {
    if (!recognitionRef.current) return
    setState((s) => ({ ...s, transcript: '', error: null, listening: true }))
    recognitionRef.current.start()
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setState((s) => ({ ...s, listening: false }))
  }, [])

  const reset = useCallback(() => {
    setState((s) => ({ ...s, transcript: '', error: null }))
  }, [])

  return { ...state, start, stop, reset }
}
