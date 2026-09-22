'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Legacy URL redirect handler.
 * If clients scan old QR codes containing specific agent tokens,
 * they are redirected automatically to the unique global QR route.
 */
export default function QrRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/qr')
  }, [router])

  return null
}
