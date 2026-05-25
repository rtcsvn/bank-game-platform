import { useState } from 'react'
import { useAuth } from '../store/auth'

const QUICK_LOGINS = [
  { label: 'MSB Admin',      email: 'admin@msb.com.vn',     slug: 'msb', color: 'bg-red-600' },
  { label: 'MSB Marketing',  email: 'marketing@msb.com.vn', slug: 'msb', color: 'bg-red-500' },
  { label: 'MSB Director',   email: 'director@msb.com.vn',  slug: 'msb', color: 'bg-red-400' },
  { label: 'MSB Game Ops',   email: 'gameops@msb.com.vn',   slug: 'msb', color: 'bg-orange-500' },
  { label: 'MBB Admin',      email: 'admin@mbbank.com.vn',  slug: 'mbb', color: 'bg-purple-600' },
  { label: 'TPB Admin',      email: 'admin@tpbank.vn',      slug: 'tpb', color: 'bg-blue-600' },
  { label: 'Super Admin',    email: 'root@platform.io',     slug: '',    color: 'bg-gray-800' },
]

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const { login, loading } = useAuth()
  const [email, setEmail] = useState('admin@msb.com.vn')
  const [password, setPassword] = useState('Demo@123456')
  const [tenantSlug, setTenantSlug] = useState('msb')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await login(email, password, tenantSlug || undefined)
      onLogin()
    } catch {
      setError('Sai email hoặc mật khẩu')
    }
  }

  async function quickLogin(q: typeof QUICK_LOGINS[0]) {
    setError('')
    try {
      await login(q.email, 'Demo@123456', q.slug || undefined)
      onLogin()
    } catch {
      setError('Đăng nhập nhanh thất bại')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-700 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-2xl mb-3">
            <span className="text-white text-2xl">🎮</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Bank Game Platform</h1>
          <p className="text-gray-500 text-sm mt-1">Admin Portal</p>
        </div>

        {/* Quick login buttons */}
        <div className="mb-6">
          <p className="text-xs text-gray-500 mb-2 font-medium">ĐĂNG NHẬP NHANH (Demo@123456)</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_LOGINS.map((q) => (
              <button
                key={q.email}
                onClick={() => quickLogin(q)}
                disabled={loading}
                className={`${q.color} text-white text-xs py-2 px-3 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-400">hoặc đăng nhập thủ công</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngân hàng (tenant slug)</label>
            <input
              type="text" value={tenantSlug} onChange={e => setTenantSlug(e.target.value)}
              placeholder="msb / mbb / tpb (để trống nếu super admin)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-red-600 text-white py-2.5 rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  )
}
