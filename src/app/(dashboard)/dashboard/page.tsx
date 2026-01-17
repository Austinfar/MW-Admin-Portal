
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserPlus, CreditCard, Activity, TrendingUp, TrendingDown, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

import { getBusinessMetrics } from "@/lib/actions/analytics"
import { formatCurrency } from "@/lib/utils"
// Add imports
import { getCurrentUserAccess } from "@/lib/auth-utils"
import { WelcomeGreeting } from "@/components/dashboard/WelcomeGreeting"

export default async function DashboardPage() {
    const metricsPromise = getBusinessMetrics()
    const userAccessPromise = getCurrentUserAccess()

    const [metrics, userAccess] = await Promise.all([metricsPromise, userAccessPromise])
    const firstName = userAccess?.first_name || 'Coach'

    return (
        <div className="flex-1 space-y-6">
            {/* Welcome Message - Dashboard Only */}
            <div className="hidden md:block">
                <WelcomeGreeting name={firstName} />
                <p className="text-muted-foreground text-sm">
                    Here's what's happening with your clients today.
                </p>
            </div>

            {/* Top Stats Row - "Crypto Ticker" Style */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Clients
                        </CardTitle>
                        <div className="p-2 bg-primary/10 rounded-full">
                            <Users className="h-4 w-4 text-primary" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline justify-between">
                            <div className="text-3xl font-bold tracking-tight">{metrics.activeClients}</div>
                            <div className="flex items-center text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full font-medium">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                +4.5%
                            </div>
                        </div>
                        {/* Fake Sparkline */}
                        <div className="mt-4 h-1 w-full bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-primary w-[70%]" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Revenue (MoM)
                        </CardTitle>
                        <div className="p-2 bg-blue-500/10 rounded-full">
                            <CreditCard className="h-4 w-4 text-blue-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline justify-between">
                            <div className="text-3xl font-bold tracking-tight">{formatCurrency(metrics.totalRevenue)}</div>
                            <div className="flex items-center text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full font-medium">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                +19.2%
                            </div>
                        </div>
                        {/* Fake Sparkline */}
                        <div className="mt-4 h-1 w-full bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 w-[85%]" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-all duration-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Onboarding
                        </CardTitle>
                        <div className="p-2 bg-orange-500/10 rounded-full">
                            <Activity className="h-4 w-4 text-orange-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline justify-between">
                            {/* TODO: Create separate metric for onboarding/prospects if needed. For now using active counts or a placeholder */}
                            <div className="text-3xl font-bold tracking-tight">0</div>
                            <div className="flex items-center text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full font-medium">
                                <Activity className="h-3 w-3 mr-1" />
                                Active
                            </div>
                        </div>
                        {/* Fake Sparkline */}
                        <div className="mt-4 h-1 w-full bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500 w-[40%]" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-primary/20 to-secondary border-primary/20">
                    <CardContent className="flex flex-col justify-center h-full pt-6">
                        <h3 className="text-lg font-semibold mb-2">My Balance</h3>
                        {/* Placeholder for coach balance - needs commission system logic */}
                        <div className="text-4xl font-bold mb-1">$0.00</div>
                        <div className="flex items-center space-x-4 text-sm mt-4">
                            <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs">This Month</span>
                                <span className="text-primary font-medium">+$2,402</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs">Pending</span>
                                <span className="text-blue-400 font-medium">$540</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Area */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Main Graph Placeholder - "Top 3 Coin" equivalent */}
                <Card className="col-span-2 bg-card/40 border-primary/5">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Client Growth Overview</CardTitle>
                            <div className="flex space-x-2">
                                <Button variant="outline" size="sm" className="h-8 rounded-full bg-transparent border-primary/20 text-xs">1M</Button>
                                <Button variant="ghost" size="sm" className="h-8 rounded-full text-xs text-muted-foreground">3M</Button>
                                <Button variant="ghost" size="sm" className="h-8 rounded-full text-xs text-muted-foreground">6M</Button>
                                <Button variant="ghost" size="sm" className="h-8 rounded-full text-xs text-muted-foreground">1Y</Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] flex items-center justify-center rounded-xl bg-gradient-to-b from-transparent to-primary/5 border border-dashed border-primary/10 relative">
                            {/* Abstract Chart Graphic */}
                            <div className="absolute inset-x-0 bottom-0 h-[60%] opacity-20 bg-gradient-to-t from-primary/30 to-transparent clip-path-wave"></div>
                            <span className="text-muted-foreground text-sm z-10">Chart Visualization Placeholder</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Right Column - "History/Transactions" equivalent */}
                <Card className="col-span-1 bg-card/40 border-primary/5">
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {metrics.recentPayments.length === 0 && <div className="text-sm text-zinc-500">No recent activity.</div>}
                            {metrics.recentPayments.map((payment) => (
                                <div key={payment.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group">
                                    <div className="flex items-center space-x-4">
                                        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center border border-white/5 group-hover:border-primary/30 transition-colors">
                                            <CreditCard className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium leading-none">Payment Received</p>
                                            <p className="text-xs text-muted-foreground mt-1">{new Date(payment.created_at).toLocaleDateString()} • {payment.client_email}</p>
                                        </div>
                                    </div>
                                    <div className="text-primary font-bold">
                                        +{formatCurrency(payment.amount / 100)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
