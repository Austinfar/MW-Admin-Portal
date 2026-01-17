'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface SidebarContextType {
    isCollapsed: boolean
    toggleSidebar: () => void
    setCollapsed: (collapsed: boolean) => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [isCollapsed, setIsCollapsed] = useState(false)

    // Persist state in localStorage
    useEffect(() => {
        const stored = localStorage.getItem('sidebar-collapsed')
        if (stored !== null) {
            setIsCollapsed(stored === 'true')
        }
    }, [])

    const toggleSidebar = () => {
        setIsCollapsed(prev => {
            const newValue = !prev
            localStorage.setItem('sidebar-collapsed', String(newValue))
            return newValue
        })
    }

    const setCollapsed = (collapsed: boolean) => {
        setIsCollapsed(collapsed)
        localStorage.setItem('sidebar-collapsed', String(collapsed))
    }

    return (
        <SidebarContext.Provider value={{ isCollapsed, toggleSidebar, setCollapsed }}>
            {children}
        </SidebarContext.Provider>
    )
}

export function useSidebar() {
    const context = useContext(SidebarContext)
    if (context === undefined) {
        throw new Error('useSidebar must be used within a SidebarProvider')
    }
    return context
}
