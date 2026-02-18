import DocumentReviewInterface from '@/components/DocumentReviewInterface'
import { Suspense } from 'react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-blue-50">
      <header className="bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Ethio-American Insurance</h1>
              <p className="text-red-100 text-sm">Document Management System - Automated Review</p>
            </div>
            <div className="flex gap-3">
              <a href="/governance" className="px-4 py-2 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-800 transition">
                Dashboard
              </a>
              <a href="/process" className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition">
                Process Folder
              </a>
              <a href={process.env.NEXT_PUBLIC_MENU_URL || "http://localhost:5000"} className="px-4 py-2 bg-white text-red-600 rounded-lg font-medium hover:bg-red-50 transition">
                Main Menu
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6 h-screen">
        <Suspense fallback={<div>Loading...</div>}>
          <DocumentReviewInterface />
        </Suspense>
      </main>
    </div>
  )
}
