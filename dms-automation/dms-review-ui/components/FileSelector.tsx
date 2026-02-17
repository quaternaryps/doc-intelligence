'use client'

import { useState, useEffect } from 'react'

export interface FileInfo {
  path: string
  name: string
  size: number
  modifiedDate: string
  isProcessed: boolean
}

interface FileSelectorProps {
  folderPath: string
  onBack: () => void
  onProcess: (files: string[]) => void
  isProcessing: boolean
  apiBaseUrl: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function FileSelector({
  folderPath,
  onBack,
  onProcess,
  isProcessing,
  apiBaseUrl,
}: FileSelectorProps) {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadFiles()
  }, [folderPath])

  const loadFiles = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `${apiBaseUrl}/folders/files?path=${encodeURIComponent(folderPath)}&maxAge=30`
      )
      const data = await response.json()

      if (data.error) {
        setError(data.error)
        setFiles([])
      } else {
        // Filter out already processed files
        const unprocessedFiles = (data.files || []).filter((f: FileInfo) => !f.isProcessed)
        setFiles(unprocessedFiles)
      }
    } catch (err) {
      setError('Failed to load files')
      console.error('Error loading files:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleFile = (filename: string) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(filename)) {
      newSelected.delete(filename)
    } else {
      newSelected.add(filename)
    }
    setSelectedFiles(newSelected)
  }

  const selectAll = () => {
    setSelectedFiles(new Set(files.map((f) => f.name)))
  }

  const deselectAll = () => {
    setSelectedFiles(new Set())
  }

  const handleProcess = () => {
    onProcess(Array.from(selectedFiles))
  }

  const folderName = folderPath.split('/').pop() || folderPath

  return (
    <div className="flex flex-col h-[500px]">
      {/* Header with Back button */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition flex items-center gap-1"
            disabled={isProcessing}
          >
            <span>&larr;</span> Back
          </button>
          <div>
            <h3 className="font-semibold text-gray-800">{folderName}</h3>
            <p className="text-xs text-gray-500 truncate max-w-md">{folderPath}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={selectAll}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            disabled={isProcessing || files.length === 0}
          >
            Select All
          </button>
          <button
            onClick={deselectAll}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            disabled={isProcessing || selectedFiles.size === 0}
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* File List - Scrollable */}
      <div className="flex-1 overflow-y-auto my-4 border border-gray-200 rounded-lg">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading files...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">{error}</div>
        ) : files.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No unprocessed files found in this folder</p>
            <p className="text-sm mt-2">Files from the last 30 days are shown</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="w-10 px-3 py-2 text-left"></th>
                <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">Filename</th>
                <th className="w-32 px-3 py-2 text-left text-sm font-medium text-gray-600">Modified</th>
                <th className="w-24 px-3 py-2 text-right text-sm font-medium text-gray-600">Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {files.map((file) => (
                <tr
                  key={file.name}
                  className={`hover:bg-gray-50 cursor-pointer ${
                    selectedFiles.has(file.name) ? 'bg-red-50' : ''
                  }`}
                  onClick={() => !isProcessing && toggleFile(file.name)}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(file.name)}
                      onChange={() => toggleFile(file.name)}
                      disabled={isProcessing}
                      className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">
                        {file.name.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}
                      </span>
                      <span className="text-sm text-gray-800 truncate max-w-[280px]" title={file.name}>
                        {file.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-500">
                    {formatDate(file.modifiedDate)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-500 text-right">
                    {formatFileSize(file.size)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          {selectedFiles.size} of {files.length} files selected
        </div>
        <button
          onClick={handleProcess}
          disabled={isProcessing || selectedFiles.size === 0}
          className={`px-6 py-2.5 rounded-lg font-medium transition ${
            isProcessing || selectedFiles.size === 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
        >
          {isProcessing ? 'Processing...' : `Process ${selectedFiles.size} File${selectedFiles.size !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
