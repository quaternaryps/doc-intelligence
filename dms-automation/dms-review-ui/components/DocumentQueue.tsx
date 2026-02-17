'use client'

import { Document } from './DocumentReviewInterface'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

interface Props {
  loading?: boolean
  documents: Document[]
  selectedDoc: Document | null
  onSelect: (doc: Document) => void
  filter: string
  onFilterChange: (filter: 'all' | 'automated' | 'errors') => void
  modifiedFids: Set<number>
  skippedFids: Set<number>
}

export function DocumentQueue({ documents, selectedDoc, onSelect, filter, onFilterChange, modifiedFids, skippedFids }: Props) {

  const getItemStyle = (doc: Document) => {
    const isSelected = selectedDoc?.fid === doc.fid
    const isModified = modifiedFids.has(doc.fid)
    const isSkipped = skippedFids.has(doc.fid)

    if (isSelected) {
      return 'bg-blue-50 border-l-4 border-blue-600'
    }
    if (isModified) {
      return 'bg-amber-50 border-l-4 border-amber-500'
    }
    if (isSkipped) {
      return 'bg-gray-100 border-l-4 border-gray-400'
    }
    return ''
  }

  const getStatusBadge = (doc: Document) => {
    if (modifiedFids.has(doc.fid)) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
          Edited
        </span>
      )
    }
    if (skippedFids.has(doc.fid)) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
          Skipped
        </span>
      )
    }
    return null
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Document Queue ({documents.length})
          {modifiedFids.size > 0 && (
            <span className="ml-2 text-sm font-normal text-amber-600">
              {modifiedFids.size} edited
            </span>
          )}
          {skippedFids.size > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              {skippedFids.size} skipped
            </span>
          )}
        </h2>

        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value as any)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="automated">Automated - Needs Review</option>
          <option value="all">All Documents</option>
          <option value="errors">Errors Only</option>
        </select>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        {documents.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <MagnifyingGlassIcon className="h-12 w-12 mx-auto mb-2" />
            <p>No documents found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {documents.map((doc) => (
              <button
                key={doc.fid}
                onClick={() => onSelect(doc)}
                className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${getItemStyle(doc)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {doc.policyNumber}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-1">
                      {doc.filename}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        {doc.documentType}
                      </span>
                      {getStatusBadge(doc)}
                      <span className="text-xs text-gray-400">
                        {new Date(doc.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {doc.suggestedType && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      AI suggests: <span className="font-medium text-gray-700">{doc.suggestedType}</span>
                      <span className="ml-2 text-gray-400">({doc.confidence}%)</span>
                    </p>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
