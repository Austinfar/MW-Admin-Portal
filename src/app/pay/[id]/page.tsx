import { Metadata } from 'next'
import { getPaymentSchedule } from '@/lib/actions/stripe-actions'
import PaymentPageClient from './components/PaymentPageClient'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params
    const { data: schedule } = await getPaymentSchedule(id)

    const title = schedule ? `${schedule.plan_name} | Payment Link` : 'Secure Payment | Payment Link'

    return {
        title: title,
    }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return <PaymentPageClient id={id} />
}
