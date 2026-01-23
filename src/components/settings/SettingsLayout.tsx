
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'

interface SettingsLayoutProps {
    children: React.ReactNode
    activeTab?: 'general' | 'team' | 'onboarding' | 'sms-checkin'
}

export function SettingsLayout({ children, activeTab = 'general' }: SettingsLayoutProps) {
    const tabs = [
        { id: 'general', label: 'General', href: '/settings' },
        { id: 'team', label: 'Team', href: '/settings/team' },
        { id: 'onboarding', label: 'Onboarding', href: '/settings/onboarding' },
        { id: 'sms-checkin', label: 'SMS Check-in', href: '/settings/sms-checkin' },
    ]

    return (
        <div className="flex-1 space-y-6">
            <div className="space-y-0.5">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Settings</h2>
                <p className="text-muted-foreground">
                    Manage your dashboard configurations and preferences.
                </p>
            </div>
            <Separator className="my-6" />
            <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
                <aside className="-mx-4 lg:w-1/5">
                    <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
                        {tabs.map((tab) => (
                            <Link
                                key={tab.id}
                                href={tab.href}
                                className={`justify-start inline-flex items-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 ${activeTab === tab.id
                                        ? 'bg-muted hover:bg-muted text-foreground'
                                        : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                                    }`}
                            >
                                {tab.label}
                            </Link>
                        ))}
                    </nav>
                </aside>
                <div className="flex-1 lg:max-w-2xl">
                    {children}
                </div>
            </div>
        </div>
    )
}
