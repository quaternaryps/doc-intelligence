'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import AutocompleteInput from './AutocompleteInput'

interface Document {
  fid: number
  filename: string
  policyNumber: string
  documentType: string
  suggestedType: string
  confidence: number
  client: string
  thumbnailPath: string
  timestamp: string
}

interface DocumentViewerProps {
  document: Document | null
  onApprove: (data: Partial<Document>) => void
  onSkip: () => void
  onDelete: () => void
  onModified?: (fid: number) => void
}

const DOCUMENT_TYPES = [
  'ACE Offer', 'ADDRESS CHANGE', 'AGENCY LETTER', 'Appraisal', 'AUTHORIZATION',
  'AUTO DECLARATION', 'BI Demand', 'BUSINESS LICENSE', 'Bill of Sale',
  'CERT OF LIABILITY', 'CERTIFICATE OF COMPLETION', 'CHARGE BACK', 'CLAIM FILE',
  'Cancelation Request', 'Cancellation notice', 'Claim Payment Request',
  'Correspondence', 'Endorsement', 'Letter of Guarantee', 'MVR', 'NO LOSS',
  'Vehicle Picture'
]

const ZOOM_LEVEL = 5
const LENS_SIZE = 220

export default function DocumentViewer({ document, onApprove, onSkip, onDelete, onModified }: DocumentViewerProps) {
  const [policyNumber, setPolicyNumber] = useState('')
  const [client, setClient] = useState('')
  const [clientAutoFilled, setClientAutoFilled] = useState(false)
  const [documentType, setDocumentType] = useState('')
  const [showLens, setShowLens] = useState(false)
  const [lensFrozen, setLensFrozen] = useState(false)
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 })
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (document) {
      setPolicyNumber(document.policyNumber)
      setClient(document.client)
      setClientAutoFilled(false)
      setDocumentType('')
      // Reset lens when switching documents
      setShowLens(false)
      setLensFrozen(false)
    }
  }, [document])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Escape dismisses a frozen lens
      if (e.key === 'Escape' && lensFrozen) {
        setLensFrozen(false)
        setShowLens(false)
        return
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        return
      }
      if (e.key === 'ArrowLeft') onSkip()
      if (e.key === 'ArrowRight') onSkip()
      if (e.key === 'Enter') handleApprove()
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [policyNumber, client, documentType, lensFrozen])

  const dismissFrozenLens = useCallback(() => {
    if (lensFrozen) {
      setLensFrozen(false)
      setShowLens(false)
    }
  }, [lensFrozen])

  const handleFieldChange = useCallback((setter: (val: string) => void, value: string) => {
    setter(value)
    if (document && onModified) {
      onModified(document.fid)
    }
  }, [document, onModified])

  const handleFieldBlur = useCallback(() => {
    dismissFrozenLens()
  }, [dismissFrozenLens])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (lensFrozen) return
    const img = imgRef.current
    if (!img) return
    const rect = img.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setLensPos({ x, y })
  }, [lensFrozen])

  const handleImageClick = useCallback(() => {
    if (lensFrozen) {
      // Click again to unfreeze
      setLensFrozen(false)
      setShowLens(false)
    } else if (showLens) {
      // Freeze in place
      setLensFrozen(true)
    }
  }, [lensFrozen, showLens])

  const handleApprove = () => {
    if (!policyNumber || !documentType) {
      alert('Please enter policy number and select document type')
      return
    }
    setLensFrozen(false)
    setShowLens(false)
    onApprove({ policyNumber, client, documentType })
  }

  const handlePolicySelect = (item: any) => {
    setPolicyNumber(item.policy)
    if (item.client && item.client !== 'Unknown') {
      setClient(item.client)
      setClientAutoFilled(true)
    }
    if (document && onModified) {
      onModified(document.fid)
    }
  }

  if (!document) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 bg-white rounded-lg shadow-md">
        Select a document to review
      </div>
    )
  }

  const thumbnailUrl = `/api/thumbnail/${encodeURIComponent(document.thumbnailPath)}`
  const confidenceColor = document.confidence >= 80 ? 'bg-green-500' :
                         document.confidence >= 60 ? 'bg-yellow-500' : 'bg-red-500'

  const lensSize = LENS_SIZE
  const lensVisible = showLens || lensFrozen

  const openOriginalDMS = () => {
    if (policyNumber) {
      // Open original Drupal DMS with policy number lookup
      const dmsUrl = process.env.NEXT_PUBLIC_DMS_URL || 'http://localhost'
      window.open(`${dmsUrl}/search?search=${encodeURIComponent(policyNumber)}&&`, '_blank')
    } else {
      alert('Please enter a policy number first')
    }
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow-md p-6 overflow-y-auto">
      {/* Thumbnail with Magnifier Lens */}
      <div className="mb-6 bg-gray-50 rounded-lg p-4 flex items-center justify-center" style={{ minHeight: '500px' }}>
        <div className="relative inline-block" style={{ cursor: lensFrozen ? 'pointer' : (showLens ? 'none' : 'crosshair') }}>
          <img
            ref={imgRef}
            src={thumbnailUrl}
            alt={document.filename}
            className="max-w-full object-contain rounded shadow-sm"
            style={{ maxHeight: '480px' }}
            onMouseEnter={() => { if (!lensFrozen) setShowLens(true) }}
            onMouseLeave={() => { if (!lensFrozen) setShowLens(false) }}
            onMouseMove={handleMouseMove}
            onClick={handleImageClick}
            draggable={false}
            onError={(e) => {
              e.currentTarget.src = '/api/placeholder/400/500'
              e.currentTarget.alt = 'Thumbnail not available'
            }}
          />
          {lensVisible && (
            <div
              style={{
                position: 'absolute',
                pointerEvents: 'none',
                width: `${lensSize}px`,
                height: `${lensSize}px`,
                borderRadius: '12px',
                border: `3px solid ${lensFrozen ? 'rgba(234, 88, 12, 0.8)' : 'rgba(59, 130, 246, 0.7)'}`,
                boxShadow: lensFrozen ? '0 4px 20px rgba(234, 88, 12, 0.3)' : '0 4px 20px rgba(0,0,0,0.3)',
                overflow: 'hidden',
                left: `${lensPos.x}%`,
                top: `${lensPos.y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 10,
                backgroundImage: `url(${thumbnailUrl})`,
                backgroundSize: `${ZOOM_LEVEL * 100}% ${ZOOM_LEVEL * 100}%`,
                backgroundPosition: `${lensPos.x}% ${lensPos.y}%`,
                backgroundRepeat: 'no-repeat',
                backgroundColor: 'white',
              }}
            />
          )}
          {/* Frozen indicator badge */}
          {lensFrozen && (
            <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs font-medium px-2 py-1 rounded-full shadow">
              Locked — edit a field or click image to dismiss
            </div>
          )}
          {/* Hint text */}
          <div className="absolute bottom-1 left-0 right-0 text-center text-xs text-gray-400 pointer-events-none">
            {lensFrozen ? 'Esc to dismiss' : `Hover to magnify (${ZOOM_LEVEL}x) • Click to lock`}
          </div>
        </div>
      </div>

      {/* AI Suggestion */}
      {document.suggestedType && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-blue-900">AI Classification Confidence</span>
            <span className="text-sm font-bold text-blue-900">{document.confidence}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full ${confidenceColor}`}
              style={{ width: `${document.confidence}%` }}
            />
          </div>
          <div className="text-sm text-blue-800">
            AI suggests: <span className="font-semibold">{document.suggestedType}</span>
          </div>
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-4 mb-6">
        <AutocompleteInput
          label="Policy Number *"
          value={policyNumber}
          onChange={(v: string) => handleFieldChange(setPolicyNumber, v)}
          endpoint="/api/autocomplete/policies"
          placeholder="Start typing policy number..."
          onSelect={handlePolicySelect}
          onBlur={handleFieldBlur}
        />

        {/* Client Name Confirmation Banner */}
        {clientAutoFilled && client && (
          <div className="bg-green-50 border border-green-300 rounded-lg p-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-green-800 font-medium">Policy Holder: <span className="font-bold">{client}</span></span>
          </div>
        )}

        <AutocompleteInput
          label="Client Name *"
          value={client}
          onChange={(v: string) => { handleFieldChange(setClient, v); setClientAutoFilled(false); }}
          endpoint="/api/autocomplete/clients"
          placeholder="Start typing client name..."
          onBlur={handleFieldBlur}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Document Type *
          </label>
          <select
            value={documentType}
            onChange={(e) => handleFieldChange(setDocumentType, e.target.value)}
            onBlur={handleFieldBlur}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="">Select type...</option>
            {DOCUMENT_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {/* File Info */}
      <div className="text-sm text-gray-600 mb-4 space-y-1">
        <div><strong>Filename:</strong> {document.filename}</div>
        <div><strong>Date:</strong> {new Date(document.timestamp).toLocaleString()}</div>
        <div><strong>FID:</strong> {document.fid}</div>
      </div>

      {/* View Original DMS Button */}
      <div className="mb-4">
        <button
          onClick={openOriginalDMS}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          View in Original DMS (by Policy #)
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 flex-shrink-0 pt-2 border-t border-gray-200">
        <button
          onClick={handleApprove}
          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition text-lg"
        >
          ✓ Approve & Save
        </button>
        <button
          onClick={onSkip}
          className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-400 transition text-lg"
        >
          Skip
        </button>
        <button
          onClick={onDelete}
          className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition text-lg"
        >
          Delete
        </button>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="mt-4 text-xs text-gray-500 text-center">
        ← → Previous/Next • Enter Approve
      </div>
    </div>
  )
}
