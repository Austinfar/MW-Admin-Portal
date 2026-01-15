import Stripe from 'stripe'

// Safe initialization for build time without validation
const apiKey = process.env.STRIPE_SECRET_KEY || 'dummy_key'

export const stripe = new Stripe(apiKey, {
    // apiVersion: '2024-12-18.acacia', // Using default from package
    typescript: true,
})
