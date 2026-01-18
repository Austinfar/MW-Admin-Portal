'use client'

import { Bell, Search, User, Settings, LogOut, Shield, Menu } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Sidebar } from './Sidebar'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getCurrentUserProfile, UserProfile } from '@/lib/actions/profile'
import { UserAccess } from '@/lib/auth-utils'
import { useEasterEgg } from './EasterEggProvider'
import { GlobalSearch } from './GlobalSearch'

export function Header({ userAccess }: { userAccess?: UserAccess }) {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [searchValue, setSearchValue] = useState('')
    const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
    const { triggerEasterEgg } = useEasterEgg()

    useEffect(() => {
        getCurrentUserProfile().then(setProfile);
    }, []);

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setGlobalSearchOpen((open) => !open)
            }
        }
        document.addEventListener('keydown', down)
        return () => document.removeEventListener('keydown', down)
    }, [])

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setSearchValue(val)

        if (val.toLowerCase() === '100k month') {
            triggerEasterEgg()
            setSearchValue('')
        }
    }

    const getInitials = () => {
        if (!profile) return 'U';
        const nameParts = profile.name?.split(' ') || [];
        const first = profile.first_name?.[0] || nameParts[0]?.[0] || '';
        const last = profile.last_name?.[0] || nameParts[1]?.[0] || '';
        return (first + last).toUpperCase() || profile.email?.[0]?.toUpperCase() || 'U';
    };

    const getRoleDisplay = (role: string) => {
        switch (role) {
            case 'admin': return 'Administrator';
            case 'coach': return 'Coach';
            case 'sales_closer': return 'Sales Closer';
            default: return role;
        }
    };

    return (
        <div className="flex items-center p-6 border-b border-border/40 bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/20 relative">

            <div className="md:hidden">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="md:hidden">
                            <Menu />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 bg-sidebar text-sidebar-foreground border-r-border w-72">
                        <Sidebar isMobile userAccess={userAccess} />
                    </SheetContent>
                </Sheet>
            </div>


            <div className="ml-auto flex items-center space-x-4">
                <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={() => setGlobalSearchOpen(true)}
                >
                    <Search className="h-5 w-5 text-muted-foreground" />
                </Button>
                <GlobalSearch open={globalSearchOpen} onOpenChange={setGlobalSearchOpen} />

                <Button
                    variant="outline"
                    className="relative hidden md:flex w-64 justify-start text-muted-foreground"
                    onClick={() => setGlobalSearchOpen(true)}
                >
                    <Search className="mr-2 h-4 w-4" />
                    <span>Search...</span>
                    <kbd className="pointer-events-none absolute right-2 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                        <span className="text-xs">⌘</span>K
                    </kbd>
                </Button>

                <Button variant="ghost" size="icon" className="relative hover:bg-secondary/50 rounded-full">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <span className="absolute top-2 right-2 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                            <Avatar className="h-9 w-9 border-2 border-primary/20 cursor-pointer hover:border-primary/50 transition-colors">
                                <AvatarImage src={profile?.avatar_url || ''} alt={profile?.name || 'User'} />
                                <AvatarFallback className="bg-primary/10 text-primary">
                                    {getInitials()}
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">
                                    {profile?.name || 'User'}
                                </p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {profile?.email}
                                </p>
                                {profile?.role && (
                                    <div className="flex items-center gap-1 mt-1">
                                        <Shield className="h-3 w-3 text-primary" />
                                        <span className="text-xs text-primary">
                                            {getRoleDisplay(profile.role)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/profile" className="cursor-pointer">
                                <User className="mr-2 h-4 w-4" />
                                <span>Profile</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/settings" className="cursor-pointer">
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Settings</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <form action="/auth/signout" method="post" className="w-full">
                                <button type="submit" className="flex items-center w-full text-destructive">
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Log out</span>
                                </button>
                            </form>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}
