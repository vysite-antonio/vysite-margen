'use client'

import { useState } from 'react'

interface Props {
  text: string
  children: React.ReactNode
}

export default function Tooltip({ text, children }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <span className="block bg-slate-700 border border-slate-600 text-slate-200 text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap max-w-xs text-center">
            {text}
          </span>
          <span className="block w-2 h-2 bg-slate-700 border-r border-b border-slate-600 rotate-45 mx-auto -mt-1" />
        </span>
      )}
    </span>
  )
}
