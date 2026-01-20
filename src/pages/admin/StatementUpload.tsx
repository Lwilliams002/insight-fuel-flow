import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileSpreadsheet, ArrowRight, Check, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

type UploadStep = 'upload' | 'mapping' | 'preview' | 'processing';

interface ParsedRow {
  [key: string]: string | number;
}

interface ColumnMapping {
  merchantName: string;
  profit: string;
}

export default function StatementUpload() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [step, setStep] = useState<UploadStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [month, setMonth] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ merchantName: '', profit: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingSummary, setProcessingSummary] = useState<{
    total: number;
    matched: number;
    unmatched: number;
    totalProfit: number;
    totalPayouts: number;
  } | null>(null);

  const generateMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
    return options;
  };

  const parseFile = useCallback(async (file: File) => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<ParsedRow>(worksheet, { defval: '' });
    
    if (jsonData.length > 0) {
      const detectedHeaders = Object.keys(jsonData[0]);
      setHeaders(detectedHeaders);
      setParsedData(jsonData);
      
      // Auto-detect column mappings
      const merchantCol = detectedHeaders.find(h => 
        /merchant|name|dba|business/i.test(h)
      );
      const profitCol = detectedHeaders.find(h => 
        /profit|residual|income|amount|revenue/i.test(h)
      );
      
      setMapping({
        merchantName: merchantCol || '',
        profit: profitCol || ''
      });
    }
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(csv|xlsx|xls)$/i)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a CSV or Excel file.',
        variant: 'destructive'
      });
      return;
    }
    
    setFile(selectedFile);
    await parseFile(selectedFile);
  };

  const handleContinueToMapping = () => {
    if (!file || !month) {
      toast({
        title: 'Missing information',
        description: 'Please select a file and month.',
        variant: 'destructive'
      });
      return;
    }
    setStep('mapping');
  };

  const handleContinueToPreview = () => {
    if (!mapping.merchantName || !mapping.profit) {
      toast({
        title: 'Missing mapping',
        description: 'Please map both merchant name and profit columns.',
        variant: 'destructive'
      });
      return;
    }
    setStep('preview');
  };

  const handleProcessUpload = async () => {
    setIsProcessing(true);
    setStep('processing');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create import record
      const { data: importRecord, error: importError } = await supabase
        .from('imports')
        .insert({
          month,
          file_name: file!.name,
          status: 'processing',
          uploaded_by: user.id,
          row_count: parsedData.length
        })
        .select()
        .single();

      if (importError) throw importError;

      // Fetch all merchants and aliases for matching
      const { data: merchants } = await supabase.from('merchants').select('id, name');
      const { data: aliases } = await supabase.from('merchant_aliases').select('merchant_id, alias');
      
      // Build lookup maps
      const merchantByName = new Map<string, string>();
      merchants?.forEach(m => {
        merchantByName.set(m.name.toLowerCase().trim(), m.id);
      });
      aliases?.forEach(a => {
        merchantByName.set(a.alias.toLowerCase().trim(), a.merchant_id);
      });

      // Fetch merchant assignments with rep info
      const { data: assignments } = await supabase
        .from('merchant_assignments')
        .select('merchant_id, rep_id, percent_override, reps(default_commission_percent)')
        .is('effective_to', null);

      const assignmentMap = new Map<string, { repId: string; percent: number }>();
      assignments?.forEach((a: any) => {
        const percent = a.percent_override ?? a.reps?.default_commission_percent ?? 0;
        assignmentMap.set(a.merchant_id, { repId: a.rep_id, percent });
      });

      // Process rows
      const rawRows: any[] = [];
      const payoutRows: any[] = [];
      let matchedCount = 0;
      let totalProfit = 0;
      let totalPayouts = 0;

      for (const row of parsedData) {
        const merchantName = String(row[mapping.merchantName] || '').trim();
        const profitValue = parseFloat(String(row[mapping.profit]).replace(/[^0-9.-]/g, '')) || 0;
        const matchedMerchantId = merchantByName.get(merchantName.toLowerCase());

        totalProfit += profitValue;

        rawRows.push({
          import_id: importRecord.id,
          merchant_identifier: merchantName,
          profit: profitValue,
          raw_data: row,
          matched_merchant_id: matchedMerchantId || null
        });

        if (matchedMerchantId) {
          matchedCount++;
          const assignment = assignmentMap.get(matchedMerchantId);
          if (assignment) {
            const payoutAmount = profitValue * (assignment.percent / 100);
            totalPayouts += payoutAmount;
            
            payoutRows.push({
              import_id: importRecord.id,
              month,
              merchant_id: matchedMerchantId,
              rep_id: assignment.repId,
              profit: profitValue,
              percent_used: assignment.percent,
              payout_amount: payoutAmount
            });
          }
        }
      }

      // Insert raw rows
      const { error: rawError } = await supabase.from('import_rows_raw').insert(rawRows);
      if (rawError) throw rawError;

      // Insert payout rows
      if (payoutRows.length > 0) {
        const { error: payoutError } = await supabase.from('payout_rows').insert(payoutRows);
        if (payoutError) throw payoutError;
      }

      // Update import record with summary
      const unmatchedCount = parsedData.length - matchedCount;
      await supabase
        .from('imports')
        .update({
          status: unmatchedCount > 0 ? 'needs_review' : 'complete',
          unmatched_count: unmatchedCount,
          total_profit: totalProfit,
          total_payouts: totalPayouts
        })
        .eq('id', importRecord.id);

      setProcessingSummary({
        total: parsedData.length,
        matched: matchedCount,
        unmatched: unmatchedCount,
        totalProfit,
        totalPayouts
      });

      toast({
        title: 'Upload complete',
        description: `Processed ${parsedData.length} rows. ${matchedCount} matched.`
      });
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive'
      });
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  return (
    <AdminLayout title="Upload Statement">
      <div className="space-y-4">
        {/* Progress Steps */}
        <div className="flex items-center justify-between text-sm">
          {['Upload', 'Map Columns', 'Preview', 'Complete'].map((label, idx) => {
            const stepMap: UploadStep[] = ['upload', 'mapping', 'preview', 'processing'];
            const currentIdx = stepMap.indexOf(step);
            const isActive = idx <= currentIdx;
            const isCurrent = idx === currentIdx;
            
            return (
              <div key={label} className="flex items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                } ${isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                  {isActive && idx < currentIdx ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                {idx < 3 && <div className={`mx-2 h-0.5 w-8 ${isActive ? 'bg-primary' : 'bg-muted'}`} />}
              </div>
            );
          })}
        </div>

        {/* Step: Upload */}
        {step === 'upload' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Select File & Month
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Statement Month</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {generateMonthOptions().map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Statement File (CSV or Excel)</Label>
                <div className="relative">
                  <Input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                </div>
                {file && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileSpreadsheet className="h-4 w-4" />
                    {file.name} ({parsedData.length} rows)
                  </div>
                )}
              </div>

              <Button 
                onClick={handleContinueToMapping} 
                disabled={!file || !month}
                className="w-full"
              >
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Column Mapping */}
        {step === 'mapping' && (
          <Card>
            <CardHeader>
              <CardTitle>Map Columns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select which columns contain the merchant name and profit amount.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Merchant Name Column</Label>
                  <Select value={mapping.merchantName} onValueChange={v => setMapping(m => ({ ...m, merchantName: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Profit/Residual Column</Label>
                  <Select value={mapping.profit} onValueChange={v => setMapping(m => ({ ...m, profit: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Sample Data Preview */}
              {mapping.merchantName && mapping.profit && parsedData.length > 0 && (
                <div className="space-y-2">
                  <Label>Sample Data (first 5 rows)</Label>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Merchant</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData.slice(0, 5).map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{String(row[mapping.merchantName])}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(parseFloat(String(row[mapping.profit]).replace(/[^0-9.-]/g, '')) || 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('upload')} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleContinueToPreview} disabled={!mapping.merchantName || !mapping.profit} className="flex-1">
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <Card>
            <CardHeader>
              <CardTitle>Review & Confirm</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">Month</p>
                  <p className="text-lg font-semibold">{month}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">Total Rows</p>
                  <p className="text-lg font-semibold">{parsedData.length}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">Merchant Column</p>
                  <p className="text-lg font-semibold">{mapping.merchantName}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">Profit Column</p>
                  <p className="text-lg font-semibold">{mapping.profit}</p>
                </div>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm">
                  <strong>Total Profit:</strong>{' '}
                  {formatCurrency(
                    parsedData.reduce((sum, row) => 
                      sum + (parseFloat(String(row[mapping.profit]).replace(/[^0-9.-]/g, '')) || 0), 0
                    )
                  )}
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('mapping')} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleProcessUpload} className="flex-1">
                  Process Upload <Check className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Processing/Complete */}
        {step === 'processing' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5 text-primary" />
                    Upload Complete
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isProcessing ? (
                <div className="flex flex-col items-center py-8">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="mt-4 text-muted-foreground">Processing {parsedData.length} rows...</p>
                </div>
              ) : processingSummary && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-muted/50 p-4">
                      <p className="text-sm text-muted-foreground">Total Rows</p>
                      <p className="text-2xl font-bold">{processingSummary.total}</p>
                    </div>
                    <div className="rounded-lg bg-primary/10 p-4">
                      <p className="text-sm text-muted-foreground">Matched</p>
                      <p className="text-2xl font-bold text-primary">{processingSummary.matched}</p>
                    </div>
                    <div className={`rounded-lg p-4 ${processingSummary.unmatched > 0 ? 'bg-destructive/10' : 'bg-muted/50'}`}>
                      <p className="text-sm text-muted-foreground">Unmatched</p>
                      <p className={`text-2xl font-bold ${processingSummary.unmatched > 0 ? 'text-destructive' : ''}`}>
                        {processingSummary.unmatched}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-4">
                      <p className="text-sm text-muted-foreground">Total Payouts</p>
                      <p className="text-2xl font-bold">{formatCurrency(processingSummary.totalPayouts)}</p>
                    </div>
                  </div>

                  {processingSummary.unmatched > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <div>
                        <p className="font-medium text-destructive">Some rows need review</p>
                        <p className="text-sm text-muted-foreground">
                          {processingSummary.unmatched} merchant(s) couldn't be matched. Review them to assign to existing merchants or create new ones.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate('/admin')} className="flex-1">
                      Back to Dashboard
                    </Button>
                    {processingSummary.unmatched > 0 && (
                      <Button onClick={() => navigate('/admin/review')} className="flex-1">
                        Review Unmatched
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}