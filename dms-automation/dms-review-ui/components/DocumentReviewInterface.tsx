'use client'

import { useState, useEffect, useCallback } from 'react'
import { DocumentQueue } from './DocumentQueue'
import DocumentViewer from './DocumentViewer'
import { ProgressBar } from './ProgressBar'
import BrowseModal from './BrowseModal'
import ApprovalLogModal from './ApprovalLogModal'
import BacklogLogModal from './BacklogLogModal'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface Document {
  fid: number
  filename: string
  policyNumber: string
  documentType: string
  suggestedType: string
  confidence: number
  client: string
  timestamp: string
  thumbnailPath: string
}

export default function DocumentReviewInterface() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'automated' | 'all' | 'errors'>('automated')
  const [processed, setProcessed] = useState(0)
  const [isBrowseModalOpen, setIsBrowseModalOpen] = useState(false)
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)
  const [isBacklogLogModalOpen, setIsBacklogLogModalOpen] = useState(false)
  const [modifiedFids, setModifiedFids] = useState<Set<number>>(new Set())
  const [skippedFids, setSkippedFids] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadDocuments()
  }, [filter])

  const loadDocuments = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/documents?filter=${filter}`)
      const data = await response.json()
      setDocuments(data.documents || [])
      if (data.documents && data.documents.length > 0) {
        setSelectedDoc(data.documents[0])
      }
      setModifiedFids(new Set())
      setSkippedFids(new Set())
    } catch (error) {
      console.error('Failed to load documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const markModified = useCallback((fid: number) => {
    setModifiedFids(prev => {
      const next = new Set(prev)
      next.add(fid)
      return next
    })
    // If it was skipped before, remove from skipped since it's now modified
    setSkippedFids(prev => {
      if (!prev.has(fid)) return prev
      const next = new Set(prev)
      next.delete(fid)
      return next
    })
  }, [])

  const handleApprove = async (updatedData: Partial<Document>) => {
    if (!selectedDoc) return

    try {
      await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fid: selectedDoc.fid,
          ...updatedData,
        }),
      })

      // Remove from tracking sets
      setModifiedFids(prev => {
        const next = new Set(prev)
        next.delete(selectedDoc.fid)
        return next
      })
      setSkippedFids(prev => {
        const next = new Set(prev)
        next.delete(selectedDoc.fid)
        return next
      })

      const newDocs = documents.filter(d => d.fid !== selectedDoc.fid)
      setDocuments(newDocs)
      setProcessed(prev => prev + 1)

      if (newDocs.length > 0) {
        setSelectedDoc(newDocs[0])
      } else {
        setSelectedDoc(null)
      }
    } catch (error) {
      console.error('Failed to approve document:', error)
      alert('Failed to save changes')
    }
  }

  const handleSkip = () => {
    if (!selectedDoc) return
    // Mark as skipped only if not already modified
    if (!modifiedFids.has(selectedDoc.fid)) {
      setSkippedFids(prev => {
        const next = new Set(prev)
        next.add(selectedDoc.fid)
        return next
      })
    }
    const currentIndex = documents.findIndex(d => d.fid === selectedDoc.fid)
    const nextIndex = (currentIndex + 1) % documents.length
    setSelectedDoc(documents[nextIndex])
  }

  const handleDelete = async () => {
    if (!selectedDoc) return
    if (!confirm('Are you sure you want to delete this document?')) return

    setModifiedFids(prev => {
      const next = new Set(prev)
      next.delete(selectedDoc.fid)
      return next
    })
    setSkippedFids(prev => {
      const next = new Set(prev)
      next.delete(selectedDoc.fid)
      return next
    })

    const newDocs = documents.filter(d => d.fid !== selectedDoc.fid)
    setDocuments(newDocs)

    if (newDocs.length > 0) {
      setSelectedDoc(newDocs[0])
    } else {
      setSelectedDoc(null)
    }
  }

  const totalDocs = documents.length + processed

  const handleBrowseOpen = () => {
    setIsBrowseModalOpen(true)
  }

  const handleBrowseClose = () => {
    setIsBrowseModalOpen(false)
  }

  const handleProcessingComplete = () => {
    // Refresh the documents list after processing
    loadDocuments()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with Browse button */}
      <div className="flex items-center justify-between mb-4">
        <ProgressBar processed={processed} total={totalDocs} />
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBacklogLogModalOpen(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Backlog Logs
          </button>
          <button
            onClick={() => setIsLogModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View Log
          </button>
          <button
            onClick={handleBrowseOpen}
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Browse &amp; Import
          </button>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Document Queue - Fixed width left panel */}
        <div className="w-80 flex-shrink-0 bg-white rounded-lg shadow-md overflow-hidden">
          <DocumentQueue
            documents={documents}
            selectedDoc={selectedDoc}
            onSelect={setSelectedDoc}
            filter={filter}
            onFilterChange={setFilter}
            loading={loading}
            modifiedFids={modifiedFids}
            skippedFids={skippedFids}
          />
        </div>

        {/* Document Viewer - Takes remaining space */}
        <div className="flex-1 min-w-0">
          <DocumentViewer
            document={selectedDoc}
            onApprove={handleApprove}
            onSkip={handleSkip}
            onDelete={handleDelete}
            onModified={markModified}
          />
        </div>
      </div>

      {/* Approval Log Modal */}
      <ApprovalLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
      />

      {/* Browse Modal */}
      <BrowseModal
        isOpen={isBrowseModalOpen}
        onClose={handleBrowseClose}
        onProcessingComplete={handleProcessingComplete}
        apiBaseUrl={API_BASE_URL}
      />

      {/* Backlog Log Modal */}
      <BacklogLogModal
        isOpen={isBacklogLogModalOpen}
        onClose={() => setIsBacklogLogModalOpen(false)}
      />
    </div>
  )
}
