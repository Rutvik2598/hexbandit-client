import { beforeEach, describe, it, expect } from 'vitest'
import { useUiStore } from './uiStore'

const DEFAULTS = {
  sidebarTab: 'players' as const,
  showTradeModal: false,
  showOfferTradeModal: false,
  showSettings: false,
  muted: false,
  soundVolume: 70,
}

beforeEach(() => {
  useUiStore.setState(DEFAULTS)
})

// ── Initial state ─────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('sidebar tab defaults to players', () => {
    expect(useUiStore.getState().sidebarTab).toBe('players')
  })

  it('all modals start closed', () => {
    const s = useUiStore.getState()
    expect(s.showTradeModal).toBe(false)
    expect(s.showOfferTradeModal).toBe(false)
    expect(s.showSettings).toBe(false)
  })

  it('sound defaults: unmuted, volume 70', () => {
    expect(useUiStore.getState().muted).toBe(false)
    expect(useUiStore.getState().soundVolume).toBe(70)
  })
})

// ── setSidebarTab ─────────────────────────────────────────────────────────────

describe('setSidebarTab', () => {
  it('switches to analysis', () => {
    useUiStore.getState().setSidebarTab('analysis')
    expect(useUiStore.getState().sidebarTab).toBe('analysis')
  })

  it('switches back to players', () => {
    useUiStore.getState().setSidebarTab('analysis')
    useUiStore.getState().setSidebarTab('players')
    expect(useUiStore.getState().sidebarTab).toBe('players')
  })
})

// ── setShowTradeModal ─────────────────────────────────────────────────────────

describe('setShowTradeModal', () => {
  it('opens the trade modal', () => {
    useUiStore.getState().setShowTradeModal(true)
    expect(useUiStore.getState().showTradeModal).toBe(true)
  })

  it('closes the trade modal', () => {
    useUiStore.getState().setShowTradeModal(true)
    useUiStore.getState().setShowTradeModal(false)
    expect(useUiStore.getState().showTradeModal).toBe(false)
  })
})

// ── setShowOfferTradeModal ────────────────────────────────────────────────────

describe('setShowOfferTradeModal', () => {
  it('sets to true with a boolean', () => {
    useUiStore.getState().setShowOfferTradeModal(true)
    expect(useUiStore.getState().showOfferTradeModal).toBe(true)
  })

  it('sets to false with a boolean', () => {
    useUiStore.getState().setShowOfferTradeModal(true)
    useUiStore.getState().setShowOfferTradeModal(false)
    expect(useUiStore.getState().showOfferTradeModal).toBe(false)
  })

  it('toggles with a function updater (false → true)', () => {
    useUiStore.getState().setShowOfferTradeModal(prev => !prev)
    expect(useUiStore.getState().showOfferTradeModal).toBe(true)
  })

  it('toggles with a function updater (true → false)', () => {
    useUiStore.getState().setShowOfferTradeModal(true)
    useUiStore.getState().setShowOfferTradeModal(prev => !prev)
    expect(useUiStore.getState().showOfferTradeModal).toBe(false)
  })
})

// ── setShowSettings ───────────────────────────────────────────────────────────

describe('setShowSettings', () => {
  it('opens settings', () => {
    useUiStore.getState().setShowSettings(true)
    expect(useUiStore.getState().showSettings).toBe(true)
  })

  it('closes settings', () => {
    useUiStore.getState().setShowSettings(true)
    useUiStore.getState().setShowSettings(false)
    expect(useUiStore.getState().showSettings).toBe(false)
  })
})

// ── toggleMuted ───────────────────────────────────────────────────────────────

describe('toggleMuted', () => {
  it('mutes when unmuted', () => {
    useUiStore.getState().toggleMuted()
    expect(useUiStore.getState().muted).toBe(true)
  })

  it('unmutes when muted', () => {
    useUiStore.getState().toggleMuted()
    useUiStore.getState().toggleMuted()
    expect(useUiStore.getState().muted).toBe(false)
  })
})

// ── setSoundVolume ────────────────────────────────────────────────────────────

describe('setSoundVolume', () => {
  it('sets volume to a valid value', () => {
    useUiStore.getState().setSoundVolume(50)
    expect(useUiStore.getState().soundVolume).toBe(50)
  })

  it('clamps to 0 for negative values', () => {
    useUiStore.getState().setSoundVolume(-10)
    expect(useUiStore.getState().soundVolume).toBe(0)
  })

  it('clamps to 100 for values above 100', () => {
    useUiStore.getState().setSoundVolume(150)
    expect(useUiStore.getState().soundVolume).toBe(100)
  })

  it('accepts exactly 0', () => {
    useUiStore.getState().setSoundVolume(0)
    expect(useUiStore.getState().soundVolume).toBe(0)
  })

  it('accepts exactly 100', () => {
    useUiStore.getState().setSoundVolume(100)
    expect(useUiStore.getState().soundVolume).toBe(100)
  })
})
