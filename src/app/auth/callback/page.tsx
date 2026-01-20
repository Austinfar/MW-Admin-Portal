'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Note: 'next' param can still be used for explicit redirects (e.g., deep links)
  const explicitNext = searchParams.get('next')

  /**
   * Fetches the first permitted route for the current user.
   * This prevents redirect loops for users with limited permissions.
   */
  const getSmartRedirect = async (): Promise<string> => {
    try {
      const response = await fetch('/api/auth/smart-redirect')
      const data = await response.json()
      return data.redirect || '/roadmap'
    } catch (error) {
      console.error('Failed to get smart redirect:', error)
      return '/roadmap' // Fallback to roadmap (always accessible)
    }
  }

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient()

      // The supabase client automatically handles the hash fragment parsing
      // and session establishment when initialized in the browser.
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error) {
        console.error('Auth callback error:', error)
        // If we really don't have a session AND no hash, then error
        if (!window.location.hash) {
          router.push('/auth/auth-code-error')
        }
        return
      }

      const performRedirect = async () => {
        // Use explicit 'next' param if provided (for deep links)
        // Otherwise, use smart redirect based on permissions
        const destination = explicitNext || await getSmartRedirect()
        router.push(destination)
      }

      if (session) {
        await performRedirect()
      } else {
        // If no session yet, wait for onAuthStateChange to pick up the hash
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' && session) {
            await performRedirect()
          }
        })
        return () => {
          subscription.unsubscribe()
        }
      }
    }

    handleCallback()
  }, [router, explicitNext, searchParams])

  return (
    <div className="flex bg-background h-screen w-full items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Verifying access...</p>
      </div>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="flex bg-background h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}

