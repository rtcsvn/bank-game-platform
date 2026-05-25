import { useEffect, useState, useCallback } from 'react'
import { api } from '../utils/api'
import { useAuth } from '../store/auth'

interface Campaign {
  id: string; name: string; status: string; gameType: string
  budgetTotal: number; budgetSpent: number; startAt: string; endAt: string
  _count: { customerPlays: number; customerTurns: number }
}

interface Kpi {
  totalTurns: number; usedTurns: number; totalPlays: number
  winners: number; winRate: number
  prizeStats: { tier: string; totalQty: number; remaining: number; disbursed: number }[]
}

interface AuditEntry {
  id: string; action: string; entity: string; createdAt: string
  actor?: { email: string; role: string }
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  PAUSED: 'bg-orange-100 text-orange-700',
  ENDED: 'bg-red-100 text-red-600',
}

function fmtVnd(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`
  return n.toLocaleString('vi-VN')
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('vi-VN')
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [kpi, setKpi] = useState<Kpi | null>(null)
  const [audits, setAudits] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'campaigns' | 'audit'>('campaigns')

  const loadCampaigns = useCallback(async () => {
    try {
      const { data } = await api.get('/campaigns')
      setCampaigns(data)
      if (data.length > 0 && !selectedCampaign) setSelectedCampaign(data[0])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [selectedCampaign])

  const loadKpi = useCallback(async (id: string) => {
    try {
      const { data } = await api.get(`/reports/campaigns/${id}/kpis`)
      setKpi(data)
    } catch { setKpi(null) }
  }, [])

  const loadAudit = useCallback(async () => {
    try {
      const { data } = await api.get('/audit?pageSize=20')
      setAudits(data.logs ?? [])
    } catch { setAudits([]) }
  }, [])

  useEffect(() => { loadCampaigns(); loadAudit() }, [])
  useEffect(() => { if (selectedCampaign) loadKpi(selectedCampaign.id) }, [selectedCampaign])

  async function handleTransition(id: string, action: string) {
    try {
      await api.post(`/campaigns/${id}/${action}`)
      loadCampaigns()
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Lỗi')
    }
  }

  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">🎮</div>
          <div>
            <h1 className="font-bold text-gray-900 text-sm">Bank Game Platform</h1>
            <p className="text-xs text-gray-500">{user?.role} · tenant: {user?.tenantId?.slice(0,8) ?? 'all'}</p>
          </div>
        </div>
        <button onClick={logout} className="text-xs text-gray-500 hover:text-red-600 px-3 py-1.5 border border-gray-200 rounded-lg">
          Đăng xuất
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: campaign list */}
        <aside className="w-72 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-sm text-gray-700">Chiến dịch</span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{activeCampaigns} active</span>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-4 text-sm text-gray-400">Đang tải...</div>
            ) : campaigns.length === 0 ? (
              <div className="p-4 text-sm text-gray-400">Không có chiến dịch</div>
            ) : campaigns.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCampaign(c)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition ${selectedCampaign?.id === c.id ? 'bg-red-50 border-l-2 border-l-red-500' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-gray-800 leading-tight">{c.name}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {c.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{fmtDate(c.startAt)} → {fmtDate(c.endAt)}</p>
                <p className="text-xs text-gray-500 mt-0.5">💰 {fmtVnd(c.budgetTotal)} VND</p>
              </button>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
            {(['campaigns', 'audit'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t === 'campaigns' ? '📊 KPI Chiến dịch' : '📋 Audit Log'}
              </button>
            ))}
          </div>

          {tab === 'campaigns' && (
            <>
              {selectedCampaign ? (
                <div className="space-y-6">
                  {/* Campaign header */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">{selectedCampaign.name}</h2>
                        <p className="text-sm text-gray-500 mt-1">
                          {fmtDate(selectedCampaign.startAt)} → {fmtDate(selectedCampaign.endAt)} · {selectedCampaign.gameType}
                        </p>
                      </div>
                      <span className={`text-sm px-3 py-1 rounded-full font-semibold ${STATUS_COLOR[selectedCampaign.status]}`}>
                        {selectedCampaign.status}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-4 flex-wrap">
                      {selectedCampaign.status === 'DRAFT' && (
                        <button onClick={() => handleTransition(selectedCampaign.id, 'submit')}
                          className="px-3 py-1.5 bg-yellow-500 text-white text-xs rounded-lg font-medium hover:bg-yellow-600">
                          Gửi duyệt →
                        </button>
                      )}
                      {selectedCampaign.status === 'PENDING_APPROVAL' && (
                        <>
                          <button onClick={() => handleTransition(selectedCampaign.id, 'approve')}
                            className="px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg font-medium hover:bg-green-600">
                            ✅ Duyệt
                          </button>
                          <button onClick={() => handleTransition(selectedCampaign.id, 'reject')}
                            className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg font-medium hover:bg-red-600">
                            ❌ Từ chối
                          </button>
                        </>
                      )}
                      {selectedCampaign.status === 'APPROVED' && (
                        <button onClick={() => handleTransition(selectedCampaign.id, 'activate')}
                          className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg font-medium hover:bg-blue-600">
                          ▶️ Kích hoạt
                        </button>
                      )}
                      {selectedCampaign.status === 'ACTIVE' && (
                        <button onClick={() => handleTransition(selectedCampaign.id, 'pause')}
                          className="px-3 py-1.5 bg-orange-500 text-white text-xs rounded-lg font-medium hover:bg-orange-600">
                          ⏸ Tạm dừng
                        </button>
                      )}
                    </div>
                  </div>

                  {/* KPI cards */}
                  {kpi && (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: 'Tổng lượt', value: kpi.totalTurns.toLocaleString(), icon: '🎫', color: 'blue' },
                          { label: 'Đã dùng', value: kpi.usedTurns.toLocaleString(), icon: '✅', color: 'green' },
                          { label: 'Lượt chơi', value: kpi.totalPlays.toLocaleString(), icon: '🎯', color: 'purple' },
                          { label: 'Người thắng', value: kpi.winners.toLocaleString(), icon: '🏆', color: 'yellow' },
                        ].map(k => (
                          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-5">
                            <div className="text-2xl mb-2">{k.icon}</div>
                            <div className="text-2xl font-bold text-gray-900">{k.value}</div>
                            <div className="text-xs text-gray-500 mt-1">{k.label}</div>
                          </div>
                        ))}
                      </div>

                      <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-gray-800">Win Rate</h3>
                          <span className="text-2xl font-bold text-green-600">{(kpi.winRate * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3">
                          <div
                            className="bg-green-500 h-3 rounded-full transition-all"
                            style={{ width: `${Math.min(kpi.winRate * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Prize stats */}
                      <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <h3 className="font-semibold text-gray-800 mb-4">Giải thưởng theo tier</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                                <th className="pb-2 font-medium">Tier</th>
                                <th className="pb-2 font-medium text-right">Tổng SL</th>
                                <th className="pb-2 font-medium text-right">Đã phát</th>
                                <th className="pb-2 font-medium text-right">Còn lại</th>
                                <th className="pb-2 font-medium">Tiến độ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {kpi.prizeStats.map((p, i) => (
                                <tr key={i} className="border-b border-gray-50">
                                  <td className="py-2 font-medium">{p.tier}</td>
                                  <td className="py-2 text-right">{p.totalQty.toLocaleString()}</td>
                                  <td className="py-2 text-right text-green-600">{p.disbursed.toLocaleString()}</td>
                                  <td className="py-2 text-right text-gray-500">{p.remaining.toLocaleString()}</td>
                                  <td className="py-2 pl-4">
                                    <div className="w-24 bg-gray-100 rounded-full h-2">
                                      <div
                                        className="bg-red-500 h-2 rounded-full"
                                        style={{ width: `${p.totalQty > 0 ? (p.disbursed / p.totalQty) * 100 : 0}%` }}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Raw counts */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="font-semibold text-gray-800 mb-3">Thống kê DB</h3>
                    <div className="flex gap-6 text-sm text-gray-600">
                      <span>🎫 {selectedCampaign._count.customerTurns.toLocaleString()} turns trong DB</span>
                      <span>🎯 {selectedCampaign._count.customerPlays.toLocaleString()} plays trong DB</span>
                      <span>💰 Budget: {fmtVnd(selectedCampaign.budgetTotal)} VND</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 text-gray-400">
                  <div className="text-4xl mb-3">📊</div>
                  <p>Chọn một chiến dịch ở bên trái</p>
                </div>
              )}
            </>
          )}

          {tab === 'audit' && (
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">Audit Log (20 gần nhất)</h3>
              </div>
              {audits.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">Không có log</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="px-4 py-3 text-left font-medium">Action</th>
                      <th className="px-4 py-3 text-left font-medium">Entity</th>
                      <th className="px-4 py-3 text-left font-medium">Actor</th>
                      <th className="px-4 py-3 text-left font-medium">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audits.map(a => (
                      <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{a.action}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{a.entity}</td>
                        <td className="px-4 py-3 text-gray-600">{a.actor?.email ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-400">{new Date(a.createdAt).toLocaleString('vi-VN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
