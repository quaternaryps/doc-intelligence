'use client'

import { useState } from 'react'
import FolderBrowser from './FolderBrowser'
import FileSelector from './FileSelector'

interface ProcessingProgress {
  current: number
  total: number
  currentFile: string
  status: 'processing' | 'completed' | 'error'
}

interface ProcessingResult {
  success: boolean
  totalFiles: number
  processed: number
  failed: number
  errors: string[]
}

interface BrowseModalProps {
  isOpen: boolean
  onClose: () => void
  onProcessingComplete: () => void
  apiBaseUrl: string
}

type ModalStep = 'folders' | 'files' | 'processing' | 'complete'

export default function BrowseModal({
  isOpen,
  onClose,
  onProcessingComplete,
  apiBaseUrl,
}: BrowseModalProps) {
  const [step, setStep] = useState<ModalStep>('folders')
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState<ProcessingProgress | null>(null)
  const [result, setResult] = useState<ProcessingResult | null>(null)

  const handleSelectFolder = (path: string) => {
    setSelectedFolder(path)
    setStep('files')
  }

  const handleBack = () => {
    setSelectedFolder(null)
    setStep('folders')
  }

  const handleProcess = async (filenames: string[]) => {
    if (!selectedFolder || filenames.length === 0) return

    setIsProcessing(true)
    setStep('processing')
    setProgress({
      current: 0,
      total: filenames.length,
      currentFile: filenames[0],
      status: 'processing',
    })

    try {
      const response = await fetch(`${apiBaseUrl}/process/selected`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: selectedFolder,
          filenames,
        }),
      })

      const data = await response.json()

      setResult(data)
      setStep('complete')

      // Notify parent to refresh documents list
      if (data.success && data.processed > 0) {
        onProcessingComplete()
      }
    } catch (error) {
      console.error('Processing error:', error)
      setResult({
        success: false,
        totalFiles: filenames.length,
        processed: 0,
        failed: filenames.length,
        errors: ['Failed to process files. Please try again.'],
      })
      setStep('complete')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    // Reset state
    setStep('folders')
    setSelectedFolder(null)
    setProgress(null)
    setResult(null)
    setIsProcessing(false)
    onClose()
  }

  const handleDone = () => {
    handleClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={!isProcessing ? handleClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            {step === 'folders' && 'Browse Folders'}
            {step === 'files' && 'Select Files to Process'}
            {step === 'processing' && 'Processing Files'}
            {step === 'complete' && 'Processing Complete'}
          </h2>
          {!isProcessing && (
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6">
          {step === 'folders' && (
            <FolderBrowser
              onSelectFolder={handleSelectFolder}
              apiBaseUrl={apiBaseUrl}
            />
          )}

          {step === 'files' && selectedFolder && (
            <FileSelector
              folderPath={selectedFolder}
              onBack={handleBack}
              onProcess={handleProcess}
              isProcessing={isProcessing}
              apiBaseUrl={apiBaseUrl}
            />
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-full max-w-md">
                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Processing files...</span>
                    <span>
                      {progress?.current || 0} / {progress?.total || 0}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-600 rounded-full transition-all duration-300"
                      style={{
                        width: `${progress ? (progress.current / progress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Current file */}
                {progress?.currentFile && (
                  <div className="text-center">
                    <div className="text-sm text-gray-500 mb-1">Currently processing:</div>
                    <div className="text-gray-800 font-medium truncate">
                      {progress.currentFile}
                    </div>
                  </div>
                )}

                {/* Spinner */}
                <div className="flex justify-center mt-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-red-600"></div>
                </div>
              </div>
            </div>
          )}

          {step === 'complete' && result && (
            <div className="flex flex-col items-center justify-center py-8">
              {/* Success/Error Icon */}
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                result.failed === 0 ? 'bg-green-100' : result.processed === 0 ? 'bg-red-100' : 'bg-yellow-100'
              }`}>
                {result.failed === 0 ? (
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : result.processed === 0 ? (
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
              </div>

              {/* Summary */}
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                {result.failed === 0
                  ? 'All files processed successfully!'
                  : result.processed === 0
                  ? 'Processing failed'
                  : 'Processing completed with errors'}
              </h3>

              <div className="text-gray-600 mb-6">
                <span className="text-green-600 font-medium">{result.processed}</span> processed
                {result.failed > 0 && (
                  <>
                    {' / '}
                    <span className="text-red-600 font-medium">{result.failed}</span> failed
                  </>
                )}
                {' / '}
                <span>{result.totalFiles}</span> total
              </div>

              {/* Errors */}
              {result.errors && result.errors.length > 0 && (
                <div className="w-full max-w-md mb-6">
                  <div className="text-sm font-medium text-gray-700 mb-2">Errors:</div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                    {result.errors.map((error, i) => (
                      <div key={i} className="text-sm text-red-700 mb-1 last:mb-0">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Done button */}
              <button
                onClick={handleDone}
                className="px-8 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
