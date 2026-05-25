import { useState, useEffect } from 'react'
import { useAuth } from './store/auth'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'

export default function App() {
  const { user } = useAuth()
  const [authed, setAuthed] = useState(!!user)

  useEffect(() => { setAuthed(!!user) }, [user])

  if (!authed) return <LoginPage onLogin={() => setAuthed(true)} />
  return <Dashboard />
}
