import { createContext, useContext, useState, type ReactNode } from 'react'
import api from './api'

export interface AuthUser {
  username: string
  role: 'USER' | 'ADMIN'
}

interface AuthContextValue {
  user: AuthUser | null
  login: (username: string, password: string) => Promise<AuthUser>
  register: (username: string, password: string) => Promise<AuthUser>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadUser(): AuthUser | null {
  const raw = localStorage.getItem('cube_user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadUser)

  async function doAuth(path: 'login' | 'register', username: string, password: string): Promise<AuthUser> {
    const res = await api.post(`/auth/${path}`, { username, password })
    const data = res.data as { token: string; username: string; role: AuthUser['role'] }
    localStorage.setItem('cube_token', data.token)
    const next: AuthUser = { username: data.username, role: data.role }
    localStorage.setItem('cube_user', JSON.stringify(next))
    setUser(next)
    return next
  }

  function logout() {
    localStorage.removeItem('cube_token')
    localStorage.removeItem('cube_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login: (u, p) => doAuth('login', u, p),
        register: (u, p) => doAuth('register', u, p),
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
