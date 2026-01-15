'use client'

import { Bell, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Sidebar } from './Sidebar'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'

export function Header() {
    return (
        <div className="flex items-center p-6 border-b border-border/40 bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/20">
            <div className="md:hidden">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="md:hidden">
                            <Menu />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 bg-sidebar text-sidebar-foreground border-r-border">
                        <Sidebar />
                    </SheetContent>
                </Sheet>
            </div>

            <div className="hidden md:flex flex-col">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    Welcome Back, John!
                </h2>
                <p className="text-muted-foreground text-sm">
                    Here's what's happening with your clients today.
                </p>
            </div>

            <div className="ml-auto flex items-center space-x-4">
                <div className="relative hidden md:block w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search..."
                        className="w-full bg-secondary/50 border-transparent focus-visible:ring-primary rounded-full pl-9"
                    />
                </div>

                <Button variant="ghost" size="icon" className="relative hover:bg-secondary/50 rounded-full">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <span className="absolute top-2 right-2 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                </Button>
                <Avatar className="h-9 w-9 border-2 border-primary/20">
                    <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                    <AvatarFallback>CN</AvatarFallback>
                </Avatar>
            </div>
        </div>
    )
}
