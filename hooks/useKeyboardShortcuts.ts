'use client'

import { useEffect, useCallback, useRef } from 'react'

type KeyCombo = string // e.g., 'ctrl+k', 'meta+shift+p', 'escape', 'enter'
type ShortcutHandler = (event: KeyboardEvent) => void

interface ShortcutConfig {
  key: KeyCombo
  handler: ShortcutHandler
  description?: string
  /** Prevent default browser behavior */
  preventDefault?: boolean
  /** Allow when focused on input/textarea */
  allowInInput?: boolean
}

/**
 * Parse a key combo string into its parts
 */
function parseKeyCombo(combo: KeyCombo) {
  const parts = combo.toLowerCase().split('+')
  const key = parts.pop() || ''
  const modifiers = {
    ctrl: parts.includes('ctrl'),
    meta: parts.includes('meta') || parts.includes('cmd'),
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
  }
  return { key, modifiers }
}

/**
 * Check if a keyboard event matches a key combo
 */
function matchesKeyCombo(event: KeyboardEvent, combo: KeyCombo): boolean {
  const { key, modifiers } = parseKeyCombo(combo)

  const eventKey = event.key.toLowerCase()
  const matchesKey = eventKey === key ||
    (key === 'escape' && eventKey === 'escape') ||
    (key === 'enter' && eventKey === 'enter') ||
    (key === 'tab' && eventKey === 'tab') ||
    (key === 'space' && eventKey === ' ') ||
    (key === 'up' && eventKey === 'arrowup') ||
    (key === 'down' && eventKey === 'arrowdown') ||
    (key === 'left' && eventKey === 'arrowleft') ||
    (key === 'right' && eventKey === 'arrowright')

  const matchesModifiers =
    modifiers.ctrl === (event.ctrlKey || false) &&
    modifiers.meta === (event.metaKey || false) &&
    modifiers.alt === (event.altKey || false) &&
    modifiers.shift === (event.shiftKey || false)

  return matchesKey && matchesModifiers
}

/**
 * Check if the event target is an input element
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  )
}

/**
 * Hook for registering keyboard shortcuts
 *
 * @example
 * useKeyboardShortcuts([
 *   { key: 'ctrl+k', handler: openSearch, description: 'Open search' },
 *   { key: 'escape', handler: closeModal, allowInInput: true },
 * ])
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  // Use ref to avoid recreating listener on every render
  const shortcutsRef = useRef(shortcuts)
  shortcutsRef.current = shortcuts

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      for (const shortcut of shortcutsRef.current) {
        if (matchesKeyCombo(event, shortcut.key)) {
          // Skip if in input and not allowed
          if (!shortcut.allowInInput && isInputElement(event.target)) {
            continue
          }

          if (shortcut.preventDefault !== false) {
            event.preventDefault()
          }

          shortcut.handler(event)
          break // Only trigger first matching shortcut
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}

/**
 * Hook for a single keyboard shortcut
 */
export function useKeyboardShortcut(
  key: KeyCombo,
  handler: ShortcutHandler,
  options: Omit<ShortcutConfig, 'key' | 'handler'> = {}
) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  const stableHandler = useCallback((event: KeyboardEvent) => {
    handlerRef.current(event)
  }, [])

  useKeyboardShortcuts([{ key, handler: stableHandler, ...options }])
}

/**
 * Format key combo for display (e.g., 'ctrl+k' -> '⌃K' on Mac)
 */
export function formatKeyCombo(combo: KeyCombo, platform: 'mac' | 'windows' = 'mac'): string {
  const { key, modifiers } = parseKeyCombo(combo)

  const parts: string[] = []

  if (platform === 'mac') {
    if (modifiers.ctrl) parts.push('⌃')
    if (modifiers.alt) parts.push('⌥')
    if (modifiers.shift) parts.push('⇧')
    if (modifiers.meta) parts.push('⌘')
  } else {
    if (modifiers.ctrl) parts.push('Ctrl')
    if (modifiers.alt) parts.push('Alt')
    if (modifiers.shift) parts.push('Shift')
    if (modifiers.meta) parts.push('Win')
  }

  // Format special keys
  const keyDisplay = {
    'escape': 'Esc',
    'enter': '↵',
    'tab': '⇥',
    'space': 'Space',
    'up': '↑',
    'down': '↓',
    'left': '←',
    'right': '→',
  }[key] || key.toUpperCase()

  parts.push(keyDisplay)

  return platform === 'mac' ? parts.join('') : parts.join('+')
}

/**
 * Detect user's platform
 */
export function usePlatform(): 'mac' | 'windows' {
  if (typeof navigator === 'undefined') return 'windows'
  return navigator.platform.toLowerCase().includes('mac') ? 'mac' : 'windows'
}
