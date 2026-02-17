'use client'

import { useState, useEffect } from 'react'

interface BacklogLog {
  runId: string
  startTime: string
  endTime?: string
  folders: Array<{
    folderPath: string
    folderDate: string
    totalFiles: number
    processed: number
    duplicates: number
    queued: number
    errors: number
    files: Array<{
      filename: string
      status: string
      parsed: {
        policyNumber: string | null
        documentType: string | null
        dateFormatted: string | null
      }
      fid?: number
      error?: string
    }>
  }>
  summary: {
    totalFolders: number
    totalFiles: number
    processed: number
    duplicates: number
    queued: number
    errors: number
  }
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function BacklogLogModal({ isOpen, onClose }: Props) {
  const [logs, setLogs] = useState<string[]>([])
  const [selectedLog, setSelectedLog] = useState<BacklogLog | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchLogsList()
    }
  }, [isOpen])

  const fetchLogsList = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/backlog-logs')
      const data = await res.json()
      setLogs(data.logs || [])
    } catch (error) {
      console.error('Failed to fetch logs list:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchLogDetails = async (logId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/backlog-logs?id=${encodeURIComponent(logId)}`)
      const data = await res.json()
      setSelectedLog(data)
    } catch (error) {
      console.error('Failed to fetch log details:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800'
      case 'duplicate': return 'bg-yellow-100 text-yellow-800'
      case 'queued': return 'bg-blue-100 text-blue-800'
      case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[85vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-900">
              Backlog Processing Logs
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 120px)' }}>
            {loading && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              </div>
            )}

            {!loading && !selectedLog && (
              <div>
                <h3 className="text-lg font-medium mb-4">Available Logs</h3>
                {logs.length === 0 ? (
                  <p className="text-gray-500">No backlog processing logs found yet.</p>
                ) : (
                  <div className="space-y-2">
                    {logs.map(logId => (
                      <button
                        key={logId}
                        onClick={() => fetchLogDetails(logId)}
                        className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
                      >
                        <div className="font-medium text-gray-900">{logId}</div>
                        <div className="text-sm text-gray-500">Click to view details</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!loading && selectedLog && (
              <div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="mb-4 text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to logs list
                </button>

                {/* Summary */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-medium mb-3">Run Summary: {selectedLog.runId}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{selectedLog.summary.totalFolders}</div>
                      <div className="text-xs text-gray-500">Folders</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{selectedLog.summary.totalFiles}</div>
                      <div className="text-xs text-gray-500">Total Files</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{selectedLog.summary.processed}</div>
                      <div className="text-xs text-gray-500">Processed</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-yellow-600">{selectedLog.summary.duplicates}</div>
                      <div className="text-xs text-gray-500">Duplicates</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{selectedLog.summary.queued}</div>
                      <div className="text-xs text-gray-500">Queued</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">{selectedLog.summary.errors}</div>
                      <div className="text-xs text-gray-500">Errors</div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-gray-500">
                    Started: {new Date(selectedLog.startTime).toLocaleString()}
                    {selectedLog.endTime && ` | Ended: ${new Date(selectedLog.endTime).toLocaleString()}`}
                  </div>
                </div>

                {/* Folders */}
                <h3 className="text-lg font-medium mb-3">Folders Processed</h3>
                <div className="space-y-2">
                  {selectedLog.folders.map(folder => (
                    <div key={folder.folderPath} className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedFolder(
                          expandedFolder === folder.folderPath ? null : folder.folderPath
                        )}
                        className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 flex justify-between items-center"
                      >
                        <div>
                          <div className="font-medium">{folder.folderDate}</div>
                          <div className="text-sm text-gray-500">{folder.totalFiles} files</div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-green-600">{folder.processed} ok</span>
                          <span className="text-yellow-600">{folder.duplicates} dup</span>
                          <span className="text-blue-600">{folder.queued} queued</span>
                          <span className="text-red-600">{folder.errors} err</span>
                          <svg
                            className={`w-5 h-5 transition-transform ${expandedFolder === folder.folderPath ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {expandedFolder === folder.folderPath && (
                        <div className="p-3 border-t bg-white">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-500">
                                <th className="pb-2">Filename</th>
                                <th className="pb-2">Status</th>
                                <th className="pb-2">Policy</th>
                                <th className="pb-2">Type</th>
                                <th className="pb-2">FID</th>
                              </tr>
                            </thead>
                            <tbody>
                              {folder.files.map((file, idx) => (
                                <tr key={idx} className="border-t">
                                  <td className="py-2 font-mono text-xs truncate max-w-xs" title={file.filename}>
                                    {file.filename}
                                  </td>
                                  <td className="py-2">
                                    <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(file.status)}`}>
                                      {file.status}
                                    </span>
                                  </td>
                                  <td className="py-2">{file.parsed.policyNumber || '-'}</td>
                                  <td className="py-2">{file.parsed.documentType || '-'}</td>
                                  <td className="py-2">{file.fid || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
