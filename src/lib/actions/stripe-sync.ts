'use server';

import { stripe } from '@/lib/stripe';

/**
 * Searches for a Stripe customer by email.
 * Returns the customer ID if found, otherwise null.
 */
export async function findStripeCustomer(email: string): Promise<string | null> {
    if (!email) return null;

    try {
        const customers = await stripe.customers.list({
            email: email,
            limit: 1,
        });

        if (customers.data.length > 0) {
            return customers.data[0].id;
        }

        return null;
    } catch (error) {
        console.error('Error finding Stripe customer:', error);
        return null;
    }
}
