import { beforeEach, describe, it, expect } from 'vitest'
import { useToastStore, addToast } from './toastStore'

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
})

// ── addToast (store action) ───────────────────────────────────────────────────

describe('addToast', () => {
  it('adds a toast to the list', () => {
    useToastStore.getState().addToast('Hello')
    expect(useToastStore.getState().toasts).toHaveLength(1)
    expect(useToastStore.getState().toasts[0].message).toBe('Hello')
  })

  it('defaults to type "info"', () => {
    useToastStore.getState().addToast('msg')
    expect(useToastStore.getState().toasts[0].type).toBe('info')
  })

  it('uses explicit type when provided', () => {
    useToastStore.getState().addToast('msg', 'success')
    expect(useToastStore.getState().toasts[0].type).toBe('success')
  })

  it('defaults duration to 4000 for non-error types', () => {
    for (const type of ['info', 'success', 'warning'] as const) {
      useToastStore.setState({ toasts: [] })
      useToastStore.getState().addToast('msg', type)
      expect(useToastStore.getState().toasts[0].duration).toBe(4000)
    }
  })

  it('defaults duration to 6000 for error type', () => {
    useToastStore.getState().addToast('msg', 'error')
    expect(useToastStore.getState().toasts[0].duration).toBe(6000)
  })

  it('uses custom duration when provided', () => {
    useToastStore.getState().addToast('msg', 'info', 1500)
    expect(useToastStore.getState().toasts[0].duration).toBe(1500)
  })

  it('custom duration overrides the error default too', () => {
    useToastStore.getState().addToast('msg', 'error', 1000)
    expect(useToastStore.getState().toasts[0].duration).toBe(1000)
  })

  it('assigns a unique string id to each toast', () => {
    useToastStore.getState().addToast('a')
    useToastStore.getState().addToast('b')
    const [t1, t2] = useToastStore.getState().toasts
    expect(typeof t1.id).toBe('string')
    expect(t1.id).not.toBe(t2.id)
  })

  it('caps the list at 5 by keeping only the last 4 existing plus the new one', () => {
    for (let i = 0; i < 6; i++) useToastStore.getState().addToast(`toast ${i}`)
    expect(useToastStore.getState().toasts).toHaveLength(5)
    expect(useToastStore.getState().toasts.at(-1)!.message).toBe('toast 5')
  })
})

// ── removeToast ───────────────────────────────────────────────────────────────

describe('removeToast', () => {
  it('removes the toast with the given id', () => {
    useToastStore.getState().addToast('keep')
    useToastStore.getState().addToast('remove')
    const toRemove = useToastStore.getState().toasts.find(t => t.message === 'remove')!
    useToastStore.getState().removeToast(toRemove.id)
    expect(useToastStore.getState().toasts).toHaveLength(1)
    expect(useToastStore.getState().toasts[0].message).toBe('keep')
  })

  it('is a no-op for an unknown id', () => {
    useToastStore.getState().addToast('a')
    useToastStore.getState().removeToast('nonexistent')
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })
})

// ── addToast standalone helper ────────────────────────────────────────────────

describe('addToast standalone helper', () => {
  it('adds a toast via the module-level helper', () => {
    addToast('standalone message', 'warning')
    const toasts = useToastStore.getState().toasts
    expect(toasts.some(t => t.message === 'standalone message' && t.type === 'warning')).toBe(true)
  })
})
