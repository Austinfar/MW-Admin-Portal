import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Payment } from "@/types/payment";
import { format } from "date-fns";
import { ExternalLink, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TransactionDetailsDialogProps {
    payment: Payment;
    children: React.ReactNode;
}

export function TransactionDetailsDialog({ payment, children }: TransactionDetailsDialogProps) {
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'succeeded':
                return <CheckCircle className="h-5 w-5 text-green-500" />;
            case 'failed':
                return <XCircle className="h-5 w-5 text-red-500" />;
            default:
                return <Clock className="h-5 w-5 text-yellow-500" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'succeeded': return 'text-green-700 bg-green-50 border-green-200';
            case 'failed': return 'text-red-700 bg-red-50 border-red-200';
            default: return 'text-yellow-700 bg-yellow-50 border-yellow-200';
        }
    };

    // Database stores amounts in dollars
    const amount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: payment.currency || 'USD',
    }).format(payment.amount);

    return (
        <Dialog>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Transaction Details</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="flex flex-col items-center justify-center space-y-2">
                        <h2 className="text-4xl font-bold tracking-tight">{amount}</h2>
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(payment.status)}`}>
                            {getStatusIcon(payment.status)}
                            <span className="capitalize">{payment.status}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                            <span className="text-muted-foreground">Date</span>
                            <p className="font-medium">
                                {format(new Date(payment.payment_date || payment.created_at), "PPP p")}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-muted-foreground">Customer</span>
                            <p className="font-medium truncate" title={payment.stripe_customer_id || "Unknown"}>
                                {/* We might need to fetch customer name from props or a join later */}
                                {payment.clients?.name || payment.client_email || payment.stripe_customer_id || "Unknown Customer"}
                            </p>
                        </div>
                        <div className="space-y-1 col-span-2">
                            <span className="text-muted-foreground">Description</span>
                            <p className="font-medium text-wrap">
                                {/* Description isn't always on payment object directly in DB, mostly metadata */}
                                {payment.product_name || `Transaction ID: ${payment.stripe_payment_id}`}
                            </p>
                        </div>
                    </div>

                    <div className="pt-4">
                        <Button className="w-full" asChild>
                            <a
                                href={`https://dashboard.stripe.com/payments/${payment.stripe_payment_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2"
                            >
                                View in Stripe
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
