
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function IndexPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    return redirect('/dashboard')
}
