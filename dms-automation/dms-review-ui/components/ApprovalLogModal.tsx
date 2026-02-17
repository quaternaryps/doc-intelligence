'use client'

import { useState, useEffect } from 'react'

interface LogEntry {
  time: string
  fid: number
  filename: string
  policyNumber: string
  client: string
  documentType: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function ApprovalLogModal({ isOpen, onClose }: Props) {
  const [days, setDays] = useState(7)
  const [summary, setSummary] = useState<any[]>([])
  const [reportByDate, setReportByDate] = useState<Record<string, LogEntry[]>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchReport()
    }
  }, [isOpen, days])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/report?days=${days}`)
      const data = await res.json()
      setSummary(data.summary || [])
      setReportByDate(data.reportByDate || {})
    } catch (error) {
      console.error('Failed to fetch report:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const dates = Object.keys(reportByDate).sort((a, b) => b.localeCompare(a))
  const totalCount = summary.reduce((sum: number, s: any) => sum + (s.total_approved || 0), 0)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Approval Activity Log</h2>
            <p className="text-sm text-gray-500 mt-1">
              {totalCount} documents approved in the last {days} days
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
            >
              <option value={1}>Today</option>
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <svg className="animate-spin h-8 w-8 mr-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading...
            </div>
          ) : dates.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg">No approval records found</p>
              <p className="text-sm mt-1">Records will appear here after documents are approved.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {dates.map(date => {
                const entries = reportByDate[date]
                const dateObj = new Date(date + 'T00:00:00')
                const formatted = dateObj.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })

                return (
                  <div key={date}>
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-sm font-bold text-gray-700">{formatted}</h3>
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                        {entries.length} approved
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-left">
                            <th className="px-3 py-2 font-medium text-gray-600">Time</th>
                            <th className="px-3 py-2 font-medium text-gray-600">Policy #</th>
                            <th className="px-3 py-2 font-medium text-gray-600">Client</th>
                            <th className="px-3 py-2 font-medium text-gray-600">Classification</th>
                            <th className="px-3 py-2 font-medium text-gray-600">Filename</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {entries.map((entry, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{entry.time}</td>
                              <td className="px-3 py-2 font-medium text-gray-900">{entry.policyNumber}</td>
                              <td className="px-3 py-2 text-gray-700">{entry.client}</td>
                              <td className="px-3 py-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                  {entry.documentType}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-500 truncate max-w-[200px]" title={entry.filename}>
                                {entry.filename}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
