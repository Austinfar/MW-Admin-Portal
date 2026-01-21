'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface DashboardGridProps {
    children: React.ReactNode
    className?: string
}

// Container animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1
        }
    }
}

// Top row grid (4 metric cards)
export function TopRowGrid({ children, className }: DashboardGridProps) {
    return (
        <motion.div
            className={cn('grid gap-6 md:grid-cols-2 lg:grid-cols-4', className)}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {children}
        </motion.div>
    )
}

// Main content grid (2/3 main + 1/3 sidebar)
export function MainContentGrid({ children, className }: DashboardGridProps) {
    return (
        <motion.div
            className={cn('grid gap-6 lg:grid-cols-3', className)}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {children}
        </motion.div>
    )
}

// Main area (2 columns)
export function MainArea({ children, className }: DashboardGridProps) {
    return (
        <div className={cn('lg:col-span-2 space-y-6', className)}>
            {children}
        </div>
    )
}

// Sidebar area (1 column)
export function SidebarArea({ children, className }: DashboardGridProps) {
    return (
        <div className={cn('lg:col-span-1 space-y-6', className)}>
            {children}
        </div>
    )
}

// Two column sub-grid within main area
export function TwoColumnGrid({ children, className }: DashboardGridProps) {
    return (
        <div className={cn('grid gap-6 md:grid-cols-2', className)}>
            {children}
        </div>
    )
}

// Full width wrapper
export function FullWidthSection({ children, className }: DashboardGridProps) {
    return (
        <div className={cn('col-span-full', className)}>
            {children}
        </div>
    )
}
