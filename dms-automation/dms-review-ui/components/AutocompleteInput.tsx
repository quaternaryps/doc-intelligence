'use client'

import { useState, useEffect, useRef } from 'react'

interface AutocompleteInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  endpoint: string
  placeholder?: string
  onSelect?: (item: any) => void
  onBlur?: () => void
}

export default function AutocompleteInput({
  label,
  value,
  onChange,
  endpoint,
  placeholder,
  onSelect,
  onBlur,
}: AutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (value.length >= 2) {
      fetchSuggestions()
    } else {
      setSuggestions([])
    }
  }, [value])

  const fetchSuggestions = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${endpoint}?q=${encodeURIComponent(value)}`)
      const data = await response.json()
      
      if (endpoint.includes('policies')) {
        setSuggestions(data.policies || [])
      } else {
        setSuggestions(data.clients || [])
      }
      
      setShowSuggestions(true)
    } catch (error) {
      console.error('Autocomplete error:', error)
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (item: any) => {
    if (endpoint.includes('policies')) {
      onChange(item.policy)
      if (onSelect) onSelect(item)
    } else {
      onChange(item.name)
      if (onSelect) onSelect(item)
    }
    setShowSuggestions(false)
    inputRef.current?.blur()
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => value.length >= 2 && setShowSuggestions(true)}
        onBlur={() => onBlur && onBlur()}
        placeholder={placeholder}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((item, index) => (
            <button
              key={index}
              onClick={() => handleSelect(item)}
              className="w-full text-left px-4 py-3 hover:bg-red-50 transition border-b border-gray-100 last:border-0"
            >
              {endpoint.includes('policies') ? (
                <div>
                  <div className="font-medium text-gray-900">{item.policy}</div>
                  <div className="text-sm text-gray-500">{item.client}</div>
                </div>
              ) : (
                <div>
                  <div className="font-medium text-gray-900">{item.name}</div>
                  <div className="text-xs text-gray-400">{item.count} documents</div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      
      {loading && (
        <div className="absolute right-3 top-9 text-gray-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      )}
    </div>
  )
}
