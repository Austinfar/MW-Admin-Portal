import { Suspense } from 'react'
import TestimonialsClient from '@/components/testimonials/TestimonialsClient'

export const metadata = {
    title: 'Testimonials | MW Coaching Dashboard',
}

export default function TestimonialsPage() {
    return (
        <div className="h-full w-full">
            <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading testimonials...</div>}>
                <TestimonialsClient />
            </Suspense>
        </div>
    )
}
