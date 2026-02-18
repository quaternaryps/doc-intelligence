'use client'

import { useState, useEffect } from 'react'

interface GovernanceData {
  overview: {
    totalDocuments: number
    automatedDocuments: number
    approvedDocuments: number
    needsReview: number
  }
  dailyVolume: Array<{ date: string; count: number }>
  documentTypes: Array<{ type: string; count: number }>
  recentApprovals: Array<{
    fid: number
    filename: string
    policyNumber: string
    client: string
    documentType: string
    approvedAt: string
  }>
  backlogRuns: Array<{
    runId: string
    startTime: string
    endTime?: string
    foldersProcessed: number
    totalFiles: number
    processed: number
    duplicates: number
    queued: number
    errors: number
  }>
  days: number
}

export default function GovernancePage() {
  const [data, setData] = useState<GovernanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)
  const [activeTab, setActiveTab] = useState<'overview' | 'processing' | 'approvals' | 'types'>('overview')

  useEffect(() => {
    loadData()
  }, [days])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/governance?days=${days}`)
      if (!res.ok) throw new Error('Failed to load data')
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <Header />
        <div className="container mx-auto px-6 py-12 text-center">
          <p className="text-red-600 text-lg">{error || 'No data available'}</p>
          <button onClick={loadData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const maxVolume = Math.max(...data.dailyVolume.map(d => d.count), 1)
  const maxTypeCount = Math.max(...data.documentTypes.map(d => d.count), 1)

  // Aggregate backlog totals
  const backlogTotals = data.backlogRuns.reduce(
    (acc, run) => ({
      files: acc.files + run.totalFiles,
      processed: acc.processed + run.processed,
      duplicates: acc.duplicates + run.duplicates,
      queued: acc.queued + run.queued,
      errors: acc.errors + run.errors,
    }),
    { files: 0, processed: 0, duplicates: 0, queued: 0, errors: 0 }
  )

  const successRate = backlogTotals.files > 0
    ? ((backlogTotals.processed / backlogTotals.files) * 100).toFixed(1)
    : '0.0'
  const duplicateRate = backlogTotals.files > 0
    ? ((backlogTotals.duplicates / backlogTotals.files) * 100).toFixed(1)
    : '0.0'
  const errorRate = backlogTotals.files > 0
    ? ((backlogTotals.errors / backlogTotals.files) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />

      <div className="container mx-auto px-6 py-6">
        {/* Time range selector */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Governance Dashboard</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Time range:</span>
            {[7, 14, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  days === d
                    ? 'bg-red-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Documents"
            value={data.overview.totalDocuments.toLocaleString()}
            color="text-gray-900"
            bgColor="bg-white"
          />
          <StatCard
            label="Auto-Processed"
            value={data.overview.automatedDocuments.toLocaleString()}
            color="text-green-700"
            bgColor="bg-green-50"
          />
          <StatCard
            label="Manually Approved"
            value={data.overview.approvedDocuments.toLocaleString()}
            color="text-blue-700"
            bgColor="bg-blue-50"
          />
          <StatCard
            label="Needs Review"
            value={data.overview.needsReview.toLocaleString()}
            color="text-amber-700"
            bgColor="bg-amber-50"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-white rounded-lg p-1 shadow-sm border">
          {(['overview', 'processing', 'approvals', 'types'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition ${
                activeTab === tab
                  ? 'bg-red-600 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab === 'overview' ? 'Daily Volume' :
               tab === 'processing' ? 'Processing Runs' :
               tab === 'approvals' ? 'Recent Approvals' : 'Document Types'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          {activeTab === 'overview' && (
            <DailyVolumeChart data={data.dailyVolume} maxVolume={maxVolume} />
          )}
          {activeTab === 'processing' && (
            <ProcessingRuns
              runs={data.backlogRuns}
              totals={backlogTotals}
              successRate={successRate}
              duplicateRate={duplicateRate}
              errorRate={errorRate}
            />
          )}
          {activeTab === 'approvals' && (
            <RecentApprovals approvals={data.recentApprovals} />
          )}
          {activeTab === 'types' && (
            <DocumentTypeDistribution types={data.documentTypes} maxCount={maxTypeCount} />
          )}
        </div>
      </div>
    </div>
  )
}

function Header() {
  return (
    <header className="bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Ethio-American Insurance</h1>
            <p className="text-red-100 text-sm">Document Management - Governance Dashboard</p>
          </div>
          <div className="flex gap-3">
            <a href="/" className="px-4 py-2 bg-white text-red-600 rounded-lg font-medium hover:bg-red-50 transition">
              Review Queue
            </a>
            <a href={process.env.NEXT_PUBLIC_MENU_URL || "http://localhost:5000"} className="px-4 py-2 bg-red-800 text-white rounded-lg font-medium hover:bg-red-900 transition">
              Main Menu
            </a>
          </div>
        </div>
      </div>
    </header>
  )
}

function StatCard({ label, value, color, bgColor }: { label: string; value: string; color: string; bgColor: string }) {
  return (
    <div className={`${bgColor} rounded-lg p-4 shadow-sm border`}>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  )
}

function DailyVolumeChart({ data, maxVolume }: { data: Array<{ date: string; count: number }>; maxVolume: number }) {
  if (data.length === 0) {
    return <p className="text-gray-500 text-center py-8">No data for selected time range.</p>
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Documents Added Per Day</h3>
      <div className="space-y-1.5">
        {data.map(item => {
          const pct = (item.count / maxVolume) * 100
          return (
            <div key={item.date} className="flex items-center gap-3">
              <div className="w-24 text-sm text-gray-500 text-right font-mono">{item.date}</div>
              <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-400 to-red-600 rounded-full transition-all"
                  style={{ width: `${Math.max(pct, 1)}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-medium text-gray-700">
                  {item.count}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProcessingRuns({
  runs,
  totals,
  successRate,
  duplicateRate,
  errorRate,
}: {
  runs: GovernanceData['backlogRuns']
  totals: { files: number; processed: number; duplicates: number; queued: number; errors: number }
  successRate: string
  duplicateRate: string
  errorRate: string
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Backlog Processing Runs</h3>

      {/* Aggregate stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold">{totals.files.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Total Files</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-green-700">{totals.processed.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Processed</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-yellow-700">{totals.duplicates.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Duplicates</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-green-700">{successRate}%</div>
          <div className="text-xs text-gray-500">Success Rate</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-yellow-700">{duplicateRate}%</div>
          <div className="text-xs text-gray-500">Duplicate Rate</div>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-red-700">{errorRate}%</div>
          <div className="text-xs text-gray-500">Error Rate</div>
        </div>
      </div>

      {runs.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No processing runs found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 pr-4">Run ID</th>
                <th className="pb-2 pr-4">Started</th>
                <th className="pb-2 pr-4 text-right">Folders</th>
                <th className="pb-2 pr-4 text-right">Files</th>
                <th className="pb-2 pr-4 text-right">Processed</th>
                <th className="pb-2 pr-4 text-right">Duplicates</th>
                <th className="pb-2 pr-4 text-right">Queued</th>
                <th className="pb-2 text-right">Errors</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(run => (
                <tr key={run.runId} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-4 font-mono text-xs">{run.runId}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {new Date(run.startTime).toLocaleDateString()}{' '}
                    {new Date(run.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2 pr-4 text-right">{run.foldersProcessed}</td>
                  <td className="py-2 pr-4 text-right">{run.totalFiles}</td>
                  <td className="py-2 pr-4 text-right text-green-700 font-medium">{run.processed}</td>
                  <td className="py-2 pr-4 text-right text-yellow-700">{run.duplicates}</td>
                  <td className="py-2 pr-4 text-right text-blue-700">{run.queued}</td>
                  <td className="py-2 text-right text-red-700">{run.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RecentApprovals({ approvals }: { approvals: GovernanceData['recentApprovals'] }) {
  if (approvals.length === 0) {
    return <p className="text-gray-500 text-center py-8">No recent approvals.</p>
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Recent Manual Approvals</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="pb-2 pr-4">FID</th>
              <th className="pb-2 pr-4">Filename</th>
              <th className="pb-2 pr-4">Policy</th>
              <th className="pb-2 pr-4">Client</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2">Approved</th>
            </tr>
          </thead>
          <tbody>
            {approvals.map(row => (
              <tr key={row.fid} className="border-b hover:bg-gray-50">
                <td className="py-2 pr-4 font-mono">{row.fid}</td>
                <td className="py-2 pr-4 max-w-xs truncate" title={row.filename}>{row.filename}</td>
                <td className="py-2 pr-4">{row.policyNumber || '-'}</td>
                <td className="py-2 pr-4">{row.client || '-'}</td>
                <td className="py-2 pr-4">{row.documentType || '-'}</td>
                <td className="py-2 text-gray-600">
                  {new Date(row.approvedAt).toLocaleDateString()}{' '}
                  {new Date(row.approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DocumentTypeDistribution({ types, maxCount }: { types: Array<{ type: string; count: number }>; maxCount: number }) {
  if (types.length === 0) {
    return <p className="text-gray-500 text-center py-8">No document type data available.</p>
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Document Type Distribution</h3>
      <div className="space-y-2">
        {types.map(item => {
          const pct = (item.count / maxCount) * 100
          return (
            <div key={item.type} className="flex items-center gap-3">
              <div className="w-48 text-sm text-gray-700 text-right truncate" title={item.type}>
                {item.type}
              </div>
              <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                  style={{ width: `${Math.max(pct, 1)}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-medium text-gray-700">
                  {item.count.toLocaleString()}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
