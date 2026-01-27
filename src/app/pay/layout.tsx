import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Payment Link | MW Fitness Coaching',
    description: 'Secure Payment Portal',
}

export default function PaymentLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return children
}
