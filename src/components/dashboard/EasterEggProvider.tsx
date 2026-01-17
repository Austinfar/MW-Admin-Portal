
'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { EasterEgg } from './EasterEgg'

interface EasterEggContextType {
    triggerEasterEgg: () => void
}

const EasterEggContext = createContext<EasterEggContextType | undefined>(undefined)

export function useEasterEgg() {
    const context = useContext(EasterEggContext)
    if (!context) {
        throw new Error('useEasterEgg must be used within an EasterEggProvider')
    }
    return context
}

export function EasterEggProvider({ children }: { children: ReactNode }) {
    const [isActive, setIsActive] = useState(false)

    const triggerEasterEgg = () => {
        setIsActive(true)
    }

    return (
        <EasterEggContext.Provider value={{ triggerEasterEgg }}>
            {children}
            <EasterEgg isActive={isActive} onComplete={() => setIsActive(false)} />
        </EasterEggContext.Provider>
    )
}
