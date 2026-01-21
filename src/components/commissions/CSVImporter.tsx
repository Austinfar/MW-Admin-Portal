'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency } from '@/lib/utils';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, X, ArrowRight } from 'lucide-react';
import { parseCSV, previewImport, importCommissions, ImportRow, ColumnMapping } from '@/lib/actions/commission-import';
import { toast } from 'sonner';

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

const FIELD_OPTIONS = [
    { value: 'coachEmail', label: 'Coach Email' },
    { value: 'coachName', label: 'Coach Name' },
    { value: 'clientName', label: 'Client Name' },
    { value: 'clientEmail', label: 'Client Email' },
    { value: 'date', label: 'Date' },
    { value: 'grossAmount', label: 'Gross Amount' },
    { value: 'commissionAmount', label: 'Commission Amount' },
    { value: 'notes', label: 'Notes' },
    { value: 'role', label: 'Role (coach/closer/setter)' },
    { value: 'leadSource', label: 'Lead Source' },
];

export function CSVImporter() {
    const [step, setStep] = useState<Step>('upload');
    const [fileName, setFileName] = useState<string>('');
    const [headers, setHeaders] = useState<string[]>([]);
    const [rows, setRows] = useState<Record<string, string>[]>([]);
    const [mapping, setMapping] = useState<ColumnMapping>({});
    const [preview, setPreview] = useState<ImportRow[]>([]);
    const [validCount, setValidCount] = useState(0);
    const [invalidCount, setInvalidCount] = useState(0);
    const [issues, setIssues] = useState<Array<{ row: number; issue: string }>>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [markAsHistorical, setMarkAsHistorical] = useState(true);
    const [importResult, setImportResult] = useState<{
        imported: number;
        skipped: number;
        errors: Array<{ row: number; error: string }>;
    } | null>(null);

    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setFileName(file.name);

        try {
            const content = await file.text();
            const { headers: parsedHeaders, rows: parsedRows } = await parseCSV(content);

            setHeaders(parsedHeaders);
            setRows(parsedRows);

            // Auto-detect mapping
            const autoMapping: ColumnMapping = {};
            parsedHeaders.forEach(header => {
                const lower = header.toLowerCase();
                if (lower.includes('coach') && lower.includes('email')) {
                    autoMapping.coachEmail = header;
                } else if (lower.includes('coach') && (lower.includes('name') || lower === 'coach')) {
                    autoMapping.coachName = header;
                } else if (lower.includes('client') && lower.includes('email')) {
                    autoMapping.clientEmail = header;
                } else if (lower.includes('client') && (lower.includes('name') || lower === 'client')) {
                    autoMapping.clientName = header;
                } else if (lower.includes('date') || lower.includes('time')) {
                    autoMapping.date = header;
                } else if (lower.includes('gross') || lower.includes('total') || lower.includes('sale')) {
                    autoMapping.grossAmount = header;
                } else if (lower.includes('commission') || lower.includes('payout') || lower.includes('earned')) {
                    autoMapping.commissionAmount = header;
                } else if (lower.includes('note') || lower.includes('comment')) {
                    autoMapping.notes = header;
                } else if (lower === 'role' || lower.includes('type')) {
                    autoMapping.role = header;
                } else if (lower.includes('source') || lower.includes('lead')) {
                    autoMapping.leadSource = header;
                }
            });
            setMapping(autoMapping);

            setStep('mapping');
        } catch (err) {
            toast.error('Failed to parse CSV file');
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const handleMappingChange = (field: keyof ColumnMapping, header: string) => {
        setMapping(prev => ({
            ...prev,
            [field]: header === '' ? undefined : header
        }));
    };

    const handlePreview = async () => {
        setIsProcessing(true);
        try {
            const result = await previewImport(rows, mapping);
            setPreview(result.preview);
            setValidCount(result.validCount);
            setInvalidCount(result.invalidCount);
            setIssues(result.issues);
            setStep('preview');
        } catch (err) {
            toast.error('Failed to generate preview');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleImport = async () => {
        setStep('importing');
        setIsProcessing(true);

        try {
            const result = await importCommissions(rows, mapping, {
                markAsHistorical
            });

            setImportResult({
                imported: result.imported,
                skipped: result.skipped,
                errors: result.errors
            });

            if (result.success) {
                toast.success(`Successfully imported ${result.imported} commission records`);
            } else {
                toast.warning(`Imported ${result.imported} records with ${result.skipped} skipped`);
            }

            setStep('complete');
        } catch (err) {
            toast.error('Import failed');
            setStep('preview');
        } finally {
            setIsProcessing(false);
        }
    };

    const reset = () => {
        setStep('upload');
        setFileName('');
        setHeaders([]);
        setRows([]);
        setMapping({});
        setPreview([]);
        setValidCount(0);
        setInvalidCount(0);
        setIssues([]);
        setImportResult(null);
    };

    return (
        <div className="space-y-6">
            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2">
                {(['upload', 'mapping', 'preview', 'complete'] as const).map((s, i) => (
                    <div key={s} className="flex items-center">
                        <div
                            className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                                step === s || (step === 'importing' && s === 'preview')
                                    ? "bg-emerald-500 text-white"
                                    : ['complete'].includes(step) || (step === 'preview' && i < 2) || (step === 'mapping' && i < 1)
                                        ? "bg-emerald-500/20 text-emerald-500"
                                        : "bg-white/10 text-muted-foreground"
                            )}
                        >
                            {i + 1}
                        </div>
                        {i < 3 && (
                            <ArrowRight className="w-4 h-4 mx-2 text-muted-foreground" />
                        )}
                    </div>
                ))}
            </div>

            {/* Step 1: Upload */}
            {step === 'upload' && (
                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5" />
                            Upload CSV File
                        </CardTitle>
                        <CardDescription>
                            Upload a CSV file with commission data. The file should include columns for coach identification and commission amounts.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border-2 border-dashed border-white/10 rounded-lg p-12 text-center hover:border-emerald-500/50 transition-colors">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileUpload}
                                className="hidden"
                                id="csv-upload"
                            />
                            <label htmlFor="csv-upload" className="cursor-pointer">
                                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                <p className="text-lg font-medium mb-2">Drop your CSV file here or click to browse</p>
                                <p className="text-sm text-muted-foreground">Supports .csv files</p>
                            </label>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Column Mapping */}
            {step === 'mapping' && (
                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <FileSpreadsheet className="h-5 w-5" />
                                Map Columns
                            </span>
                            <Badge variant="outline">{fileName}</Badge>
                        </CardTitle>
                        <CardDescription>
                            Map your CSV columns to the required fields. At minimum, you need coach identification and commission amount.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {FIELD_OPTIONS.map((field) => (
                                <div key={field.value} className="space-y-2">
                                    <Label className={cn(
                                        field.value === 'coachEmail' || field.value === 'coachName' || field.value === 'commissionAmount'
                                            ? 'text-emerald-400'
                                            : ''
                                    )}>
                                        {field.label}
                                        {(field.value === 'coachEmail' || field.value === 'coachName') && (
                                            <span className="text-xs text-muted-foreground ml-2">(Required: one of)</span>
                                        )}
                                        {field.value === 'commissionAmount' && (
                                            <span className="text-xs text-muted-foreground ml-2">(Required)</span>
                                        )}
                                    </Label>
                                    <select
                                        value={mapping[field.value as keyof ColumnMapping] || ''}
                                        onChange={(e) => handleMappingChange(field.value as keyof ColumnMapping, e.target.value)}
                                        className="w-full h-10 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    >
                                        <option value="">-- Not mapped --</option>
                                        {headers.map(header => (
                                            <option key={header} value={header}>{header}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>

                        {/* Sample Data Preview */}
                        <div className="space-y-2">
                            <Label>Sample Data (first 3 rows)</Label>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-white/5 border-white/10">
                                            {headers.map(h => (
                                                <TableHead key={h} className="text-xs">{h}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rows.slice(0, 3).map((row, i) => (
                                            <TableRow key={i} className="hover:bg-white/5 border-white/10">
                                                {headers.map(h => (
                                                    <TableCell key={h} className="text-xs text-muted-foreground">
                                                        {row[h]?.substring(0, 30) || '-'}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        <div className="flex justify-between">
                            <Button variant="outline" onClick={reset} className="bg-white/5 border-white/10">
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                            </Button>
                            <Button
                                onClick={handlePreview}
                                disabled={isProcessing || (!mapping.coachEmail && !mapping.coachName) || !mapping.commissionAmount}
                                className="bg-emerald-600 hover:bg-emerald-500"
                            >
                                {isProcessing ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <ArrowRight className="h-4 w-4 mr-2" />
                                )}
                                Preview Import
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 3: Preview */}
            {(step === 'preview' || step === 'importing') && (
                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>Import Preview</span>
                            <div className="flex gap-2">
                                <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400">
                                    {validCount} Valid
                                </Badge>
                                {invalidCount > 0 && (
                                    <Badge variant="outline" className="bg-red-500/20 text-red-400">
                                        {invalidCount} Invalid
                                    </Badge>
                                )}
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Issues */}
                        {issues.length > 0 && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                                <h4 className="text-red-400 font-medium mb-2 flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" />
                                    Issues Found ({issues.length})
                                </h4>
                                <ul className="text-sm text-red-300 space-y-1 max-h-40 overflow-y-auto">
                                    {issues.slice(0, 10).map((issue, i) => (
                                        <li key={i}>Row {issue.row}: {issue.issue}</li>
                                    ))}
                                    {issues.length > 10 && (
                                        <li className="text-muted-foreground">...and {issues.length - 10} more</li>
                                    )}
                                </ul>
                            </div>
                        )}

                        {/* Preview Table */}
                        <div className="overflow-x-auto max-h-96">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-white/5 border-white/10">
                                        <TableHead>Coach</TableHead>
                                        <TableHead>Client</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Gross</TableHead>
                                        <TableHead>Commission</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Notes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {preview.slice(0, 20).map((row, i) => (
                                        <TableRow key={i} className="hover:bg-white/5 border-white/10">
                                            <TableCell>{row.coachEmail || row.coachName || '-'}</TableCell>
                                            <TableCell>{row.clientName || row.clientEmail || '-'}</TableCell>
                                            <TableCell className="text-muted-foreground">{row.date || '-'}</TableCell>
                                            <TableCell>{row.grossAmount ? formatCurrency(row.grossAmount) : '-'}</TableCell>
                                            <TableCell className="text-emerald-400">
                                                {row.commissionAmount ? formatCurrency(row.commissionAmount) : '-'}
                                            </TableCell>
                                            <TableCell>{row.role || 'coach'}</TableCell>
                                            <TableCell className="text-muted-foreground max-w-[200px] truncate">
                                                {row.notes || '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {preview.length > 20 && (
                                <p className="text-center text-sm text-muted-foreground py-4">
                                    ...and {preview.length - 20} more rows
                                </p>
                            )}
                        </div>

                        {/* Options */}
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="markHistorical"
                                checked={markAsHistorical}
                                onChange={(e) => setMarkAsHistorical(e.target.checked)}
                                className="h-4 w-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/50"
                            />
                            <Label htmlFor="markHistorical" className="font-normal cursor-pointer">
                                Mark as historical (won't appear in current payroll)
                            </Label>
                        </div>

                        <div className="flex justify-between">
                            <Button
                                variant="outline"
                                onClick={() => setStep('mapping')}
                                disabled={step === 'importing'}
                                className="bg-white/5 border-white/10"
                            >
                                Back to Mapping
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={step === 'importing' || validCount === 0}
                                className="bg-emerald-600 hover:bg-emerald-500"
                            >
                                {step === 'importing' ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Import {validCount} Records
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 4: Complete */}
            {step === 'complete' && importResult && (
                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-emerald-400">
                            <CheckCircle2 className="h-5 w-5" />
                            Import Complete
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
                                <div className="text-3xl font-bold text-emerald-400">{importResult.imported}</div>
                                <div className="text-sm text-muted-foreground">Imported</div>
                            </div>
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-center">
                                <div className="text-3xl font-bold text-yellow-400">{importResult.skipped}</div>
                                <div className="text-sm text-muted-foreground">Skipped</div>
                            </div>
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                                <div className="text-3xl font-bold text-red-400">{importResult.errors.length}</div>
                                <div className="text-sm text-muted-foreground">Errors</div>
                            </div>
                        </div>

                        {importResult.errors.length > 0 && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                                <h4 className="text-red-400 font-medium mb-2">Errors</h4>
                                <ul className="text-sm text-red-300 space-y-1 max-h-40 overflow-y-auto">
                                    {importResult.errors.map((error, i) => (
                                        <li key={i}>Row {error.row}: {error.error}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex justify-center">
                            <Button onClick={reset} className="bg-emerald-600 hover:bg-emerald-500">
                                Import Another File
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
