
import Stripe from 'stripe'
import dotenv from 'dotenv'
import path from 'path'

// Load env vars from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-01-27.acacia',
    typescript: true,
})

async function listProducts() {
    console.log('Fetching Stripe products...')
    try {
        const prices = await stripe.prices.list({
            active: true,
            expand: ['data.product'],
            limit: 100,
        })

        const products = prices.data
            .map((price) => {
                const product = price.product as any
                return {
                    id: price.id,
                    product_name: product.name,
                    livemode: price.livemode
                }
            })
            // Deduplicate by product name
            .filter((v, i, a) => a.findIndex(t => t.product_name === v.product_name) === i)

        console.log('\n--- Active Products in Stripe ---')
        products.forEach(p => {
            console.log(`"${p.product_name}" (Livemode: ${p.livemode})`)
        })
        console.log('---------------------------------\n')

    } catch (error) {
        console.error('Error fetching products:', error)
    }
}

listProducts()
