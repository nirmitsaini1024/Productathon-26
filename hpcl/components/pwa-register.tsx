'use client'

import { useEffect } from 'react'

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const register = async () => {
      try {
        // `sw.js` is served from `/public`, so it is available at the root.
        await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      } catch (err) {
        // Keep silent in production; PWA is optional.
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn('Service worker registration failed:', err)
        }
      }
    }

    register()
  }, [])

  return null
}


