'use client'

import { useEffect, useState } from 'react'

export function WelcomeGreeting({ name }: { name: string }) {
    const [greeting, setGreeting] = useState('Welcome back')

    useEffect(() => {
        const hour = new Date().getHours()
        if (hour >= 5 && hour < 12) setGreeting('Good morning')
        else if (hour >= 12 && hour < 17) setGreeting('Good afternoon')
        else setGreeting('Good evening')
    }, [])

    return (
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {greeting}, {name}!
        </h2>
    )
}
