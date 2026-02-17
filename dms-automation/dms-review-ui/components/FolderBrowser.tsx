'use client'

import { useState, useEffect } from 'react'

interface FolderNode {
  type: 'root' | 'folder'
  name: string
  path: string
  children?: FolderNode[]
  fileCount?: number
  lastModified?: string
}

interface FolderBrowserProps {
  onSelectFolder: (path: string) => void
  apiBaseUrl: string
}

export default function FolderBrowser({ onSelectFolder, apiBaseUrl }: FolderBrowserProps) {
  const [tree, setTree] = useState<FolderNode[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRoots, setExpandedRoots] = useState<Set<string>>(new Set(['Scanner', 'Company']))
  const [highlightedPath, setHighlightedPath] = useState<string | null>(null)
  const [hasAutoHighlighted, setHasAutoHighlighted] = useState(false)

  useEffect(() => {
    loadFolderTree()
  }, [])

  // Auto-highlight Scanner/reception as default (but don't navigate)
  useEffect(() => {
    if (!hasAutoHighlighted && tree.length > 0) {
      const scannerRoot = tree.find(t => t.name === 'Scanner')
      const receptionFolder = scannerRoot?.children?.find(c => c.name === 'reception')
      if (receptionFolder) {
        setHighlightedPath(receptionFolder.path)
        setHasAutoHighlighted(true)
      }
    }
  }, [tree, hasAutoHighlighted])

  const loadFolderTree = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${apiBaseUrl}/folders/tree?days=30`)
      const data = await response.json()
      setTree(data.tree || [])
    } catch (error) {
      console.error('Failed to load folder tree:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleRoot = (name: string) => {
    const newExpanded = new Set(expandedRoots)
    if (newExpanded.has(name)) {
      newExpanded.delete(name)
    } else {
      newExpanded.add(name)
    }
    setExpandedRoots(newExpanded)
  }

  const handleHighlightFolder = (path: string) => {
    setHighlightedPath(path)
  }

  const handleOpenFolder = () => {
    if (highlightedPath) {
      onSelectFolder(highlightedPath)
    }
  }

  const handleDoubleClick = (path: string) => {
    onSelectFolder(path)
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getRootIcon = (name: string) => {
    return name === 'Scanner' ? '🖨️' : '📂'
  }

  const getSelectedFolderName = () => {
    if (!highlightedPath) return null
    for (const root of tree) {
      const folder = root.children?.find(c => c.path === highlightedPath)
      if (folder) return `${root.name}/${folder.name}`
    }
    return null
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="animate-pulse">Loading folders...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Folder Tree */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {tree.map((root) => (
          <div key={root.name} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Root Header */}
            <button
              onClick={() => toggleRoot(root.name)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{getRootIcon(root.name)}</span>
                <span className="font-semibold text-gray-800">{root.name}</span>
                <span className="text-sm text-gray-500">
                  ({root.children?.length || 0} folders)
                </span>
              </div>
              <span className="text-gray-400">
                {expandedRoots.has(root.name) ? '▼' : '▶'}
              </span>
            </button>

            {/* Children */}
            {expandedRoots.has(root.name) && root.children && root.children.length > 0 && (
              <div className="max-h-48 overflow-y-auto">
                {root.children.map((folder) => (
                  <button
                    key={folder.path}
                    onClick={() => handleHighlightFolder(folder.path)}
                    onDoubleClick={() => handleDoubleClick(folder.path)}
                    className={`w-full text-left px-4 py-2.5 border-t border-gray-100 hover:bg-gray-50 transition flex items-center justify-between ${
                      highlightedPath === folder.path ? 'bg-red-50 border-l-4 border-l-red-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">📁</span>
                      <span className="text-gray-800">{folder.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">
                        {folder.fileCount || 0} files
                      </span>
                      <span className="text-gray-400 w-16 text-right">
                        {formatDate(folder.lastModified)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Empty state */}
            {expandedRoots.has(root.name) && (!root.children || root.children.length === 0) && (
              <div className="px-4 py-6 text-center text-gray-500 text-sm border-t border-gray-100">
                No folders found
              </div>
            )}
          </div>
        ))}

        {tree.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No folders available
          </div>
        )}
      </div>

      {/* Footer with Open Button */}
      <div className="pt-4 mt-4 border-t border-gray-200 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {highlightedPath ? (
            <>Selected: <span className="font-medium">{getSelectedFolderName()}</span></>
          ) : (
            'Click a folder to select, or double-click to open'
          )}
        </div>
        <button
          onClick={handleOpenFolder}
          disabled={!highlightedPath}
          className={`px-6 py-2.5 rounded-lg font-medium transition ${
            highlightedPath
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Open Folder
        </button>
      </div>
    </div>
  )
}
