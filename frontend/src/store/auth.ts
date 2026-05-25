import { create } from 'zustand'
import { api } from '../utils/api'

interface User {
  userId: string
  email?: string
  role: string
  tenantId: string | null
}

interface AuthStore {
  user: User | null
  loading: boolean
  login: (email: string, password: string, tenantSlug?: string) => Promise<void>
  logout: () => void
}

export const useAuth = create<AuthStore>((set) => ({
  user: (() => {
    const token = localStorage.getItem('access_token')
    if (!token) return null
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return { userId: payload.userId, role: payload.role, tenantId: payload.tenantId }
    } catch { return null }
  })(),
  loading: false,

  login: async (email, password, tenantSlug) => {
    set({ loading: true })
    try {
      const { data } = await api.post('/auth/login', { email, password, tenantSlug })
      localStorage.setItem('access_token', data.accessToken)
      localStorage.setItem('refresh_token', data.refreshToken)
      const payload = JSON.parse(atob(data.accessToken.split('.')[1]))
      set({ user: { userId: payload.userId, role: payload.role, tenantId: payload.tenantId }, loading: false })
    } catch (e) {
      set({ loading: false })
      throw e
    }
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null })
  },
}))
