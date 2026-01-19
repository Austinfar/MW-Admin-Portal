'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function AuthCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/dashboard'

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

      if (session) {
        router.push(next)
      } else {
         // If no session yet, wait for onAuthStateChange to pick up the hash
         const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                router.push(next)
            }
         })
         return () => {
            subscription.unsubscribe()
         }
      }
    }

    handleCallback()
  }, [router, next, searchParams])

  return (
    <div className="flex bg-background h-screen w-full items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Verifying access...</p>
      </div>
    </div>
  )
}
