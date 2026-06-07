import { beforeEach, describe, it, expect } from 'vitest'
import { useAuthStore, type AuthUser } from './authStore'

const MOCK_USER: AuthUser = {
  name: 'Alice',
  email: 'alice@example.com',
  username: 'alice42',
  level: 5,
  elo: 1200,
  rank: 'Gold',
  provider: 'email',
}

beforeEach(() => {
  useAuthStore.setState({ user: null })
})

describe('initial state', () => {
  it('starts with no logged-in user', () => {
    expect(useAuthStore.getState().user).toBeNull()
  })
})

describe('login', () => {
  it('sets the user', () => {
    useAuthStore.getState().login(MOCK_USER)
    expect(useAuthStore.getState().user).toEqual(MOCK_USER)
  })

  it('overwrites a previously logged-in user', () => {
    useAuthStore.getState().login(MOCK_USER)
    const other: AuthUser = { ...MOCK_USER, name: 'Bob', email: 'bob@example.com' }
    useAuthStore.getState().login(other)
    expect(useAuthStore.getState().user?.name).toBe('Bob')
  })

  it('stores all user fields correctly', () => {
    useAuthStore.getState().login(MOCK_USER)
    const u = useAuthStore.getState().user!
    expect(u.username).toBe('alice42')
    expect(u.level).toBe(5)
    expect(u.elo).toBe(1200)
    expect(u.rank).toBe('Gold')
    expect(u.provider).toBe('email')
  })
})

describe('logout', () => {
  it('clears the user', () => {
    useAuthStore.getState().login(MOCK_USER)
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('is a no-op when already logged out', () => {
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().user).toBeNull()
  })
})
