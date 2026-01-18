'use server'

export async function generatePdf(htmlContent: string): Promise<{ url?: string; error?: string }> {
    const apiKey = process.env.PDF_CO_API_KEY

    if (!apiKey) {
        return { error: 'PDF.co API key not configured' }
    }

    try {
        const response = await fetch('https://api.pdf.co/v1/pdf/convert/from/html', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                html: htmlContent,
                name: 'report.pdf',
                margins: '5px 5px 5px 5px',
                paperSize: 'Letter',
                orientation: 'Portrait',
                printBackground: true,
                header: '',
                footer: ''
            }),
        })

        const data = await response.json()

        if (data.error) {
            console.error('PDF.co Error:', data.message)
            return { error: data.message || 'Failed to generate PDF' }
        }

        return { url: data.url }
    } catch (error) {
        console.error('PDF Generation Error:', error)
        return { error: 'Internal server error during PDF generation' }
    }
}
