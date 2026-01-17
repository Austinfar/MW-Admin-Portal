import Stripe from 'stripe'

// Safe initialization for build time without validation
const apiKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'

if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('STRIPE_SECRET_KEY is missing. Stripe features will not work.')
}

export const stripe = new Stripe(apiKey, {
    // apiVersion: '2024-12-18.acacia', // Using default from package
    typescript: true,
})
