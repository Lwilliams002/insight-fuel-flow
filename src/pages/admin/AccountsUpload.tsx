import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
import { Upload, FileSpreadsheet, ArrowRight, Check, Loader2, Building2 } from 'lucide-react';
import * as XLSX from 'xlsx';

type UploadStep = 'upload' | 'mapping' | 'preview' | 'processing';

interface ParsedRow {
  [key: string]: string | number;
}

interface ColumnMapping {
  merchantName: string;
  mid: string;
  repEmail: string;
}

interface ProcessedAccount {
  merchantName: string;
  mid: string;
  repEmail: string;
  status: 'new' | 'exists' | 'error';
  message?: string;
}

export default function AccountsUpload() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [step, setStep] = useState<UploadStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ merchantName: '', mid: '', repEmail: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedAccounts, setProcessedAccounts] = useState<ProcessedAccount[]>([]);
  const [summary, setSummary] = useState<{ added: number; skipped: number; errors: number } | null>(null);

  // Fetch existing reps for matching
  const { data: reps } = useQuery({
    queryKey: ['reps-for-upload'],
    queryFn: async () => {
      const { data: repsData, error: repsError } = await supabase
        .from('reps')
        .select('id, user_id, default_commission_percent');

      if (repsError) throw repsError;

      const userIds = repsData.map(r => r.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      return repsData.map(rep => ({
        ...rep,
        profile: profilesData.find(p => p.id === rep.user_id),
      }));
    },
  });

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
      const midCol = detectedHeaders.find(h => 
        /mid|account.*id|merchant.*id|id/i.test(h)
      );
      const repCol = detectedHeaders.find(h => 
        /rep|agent|email|sales/i.test(h)
      );
      
      setMapping({
        merchantName: merchantCol || '',
        mid: midCol || '',
        repEmail: repCol || ''
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
    if (!file) {
      toast({
        title: 'Missing file',
        description: 'Please select a file.',
        variant: 'destructive'
      });
      return;
    }
    setStep('mapping');
  };

  const handleContinueToPreview = () => {
    if (!mapping.merchantName) {
      toast({
        title: 'Missing mapping',
        description: 'Please map at least the merchant name column.',
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
      // Fetch existing merchants to check for duplicates
      const { data: existingMerchants } = await supabase
        .from('merchants')
        .select('id, name, mid');

      const existingByName = new Map<string, string>();
      const existingByMid = new Map<string, string>();
      existingMerchants?.forEach(m => {
        existingByName.set(m.name.toLowerCase().trim(), m.id);
        if (m.mid) existingByMid.set(m.mid.toLowerCase().trim(), m.id);
      });

      // Build rep lookup by email
      const repByEmail = new Map<string, { id: string; percent: number }>();
      reps?.forEach(rep => {
        if (rep.profile?.email) {
          repByEmail.set(rep.profile.email.toLowerCase().trim(), {
            id: rep.id,
            percent: rep.default_commission_percent,
          });
        }
      });

      const processed: ProcessedAccount[] = [];
      const newMerchants: { name: string; mid: string | null; status: string }[] = [];
      const assignments: { merchantName: string; repId: string }[] = [];

      for (const row of parsedData) {
        const merchantName = String(row[mapping.merchantName] || '').trim();
        const mid = mapping.mid ? String(row[mapping.mid] || '').trim() : '';
        const repEmail = mapping.repEmail ? String(row[mapping.repEmail] || '').trim().toLowerCase() : '';

        if (!merchantName) {
          processed.push({
            merchantName: '(empty)',
            mid,
            repEmail,
            status: 'error',
            message: 'Empty merchant name'
          });
          continue;
        }

        // Check if merchant already exists
        const existingById = mid ? existingByMid.get(mid.toLowerCase()) : null;
        const existingByN = existingByName.get(merchantName.toLowerCase());

        if (existingById || existingByN) {
          processed.push({
            merchantName,
            mid,
            repEmail,
            status: 'exists',
            message: 'Already in system'
          });
          continue;
        }

        // New merchant - will be added
        newMerchants.push({
          name: merchantName,
          mid: mid || null,
          status: 'active'
        });

        // Track assignment if rep email provided
        if (repEmail) {
          const rep = repByEmail.get(repEmail);
          if (rep) {
            assignments.push({
              merchantName,
              repId: rep.id
            });
          }
        }

        processed.push({
          merchantName,
          mid,
          repEmail,
          status: 'new',
          message: repEmail && repByEmail.has(repEmail) ? 'Will assign rep' : undefined
        });
      }

      // Insert new merchants
      if (newMerchants.length > 0) {
        const { data: insertedMerchants, error: insertError } = await supabase
          .from('merchants')
          .insert(newMerchants)
          .select('id, name');

        if (insertError) throw insertError;

        // Create assignments for newly inserted merchants
        const merchantIdByName = new Map<string, string>();
        insertedMerchants?.forEach(m => {
          merchantIdByName.set(m.name.toLowerCase(), m.id);
        });

        const assignmentInserts = assignments
          .map(a => {
            const merchantId = merchantIdByName.get(a.merchantName.toLowerCase());
            if (!merchantId) return null;
            return {
              merchant_id: merchantId,
              rep_id: a.repId,
            };
          })
          .filter(Boolean);

        if (assignmentInserts.length > 0) {
          const { error: assignError } = await supabase
            .from('merchant_assignments')
            .insert(assignmentInserts as { merchant_id: string; rep_id: string }[]);

          if (assignError) {
            console.error('Assignment error:', assignError);
          }
        }
      }

      setProcessedAccounts(processed);
      setSummary({
        added: processed.filter(p => p.status === 'new').length,
        skipped: processed.filter(p => p.status === 'exists').length,
        errors: processed.filter(p => p.status === 'error').length
      });

      toast({
        title: 'Upload complete',
        description: `Added ${newMerchants.length} new merchants.`
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

  return (
    <AdminLayout title="Upload Accounts">
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
                <Building2 className="h-5 w-5" />
                Upload Accounts File
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload a file with merchant accounts. Only new merchants (not already in the system) will be added.
                Include MID and rep email columns to auto-assign.
              </p>

              <div className="space-y-2">
                <Label>Accounts File (CSV or Excel)</Label>
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                {file && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileSpreadsheet className="h-4 w-4" />
                    {file.name} ({parsedData.length} rows)
                  </div>
                )}
              </div>

              <Button 
                onClick={handleContinueToMapping} 
                disabled={!file}
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
                Map the columns in your file. Merchant name is required. MID and Rep Email are optional.
              </p>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Merchant Name Column *</Label>
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
                  <Label>MID / Account ID Column (optional)</Label>
                  <Select value={mapping.mid} onValueChange={v => setMapping(m => ({ ...m, mid: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- None --</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Rep Email Column (optional - for auto-assignment)</Label>
                  <Select value={mapping.repEmail} onValueChange={v => setMapping(m => ({ ...m, repEmail: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- None --</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Sample Data Preview */}
              {mapping.merchantName && parsedData.length > 0 && (
                <div className="space-y-2">
                  <Label>Sample Data (first 5 rows)</Label>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Merchant</TableHead>
                          {mapping.mid && <TableHead>MID</TableHead>}
                          {mapping.repEmail && <TableHead>Rep Email</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData.slice(0, 5).map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{String(row[mapping.merchantName])}</TableCell>
                            {mapping.mid && <TableCell>{String(row[mapping.mid])}</TableCell>}
                            {mapping.repEmail && <TableCell>{String(row[mapping.repEmail])}</TableCell>}
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
                <Button onClick={handleContinueToPreview} disabled={!mapping.merchantName} className="flex-1">
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
                  <p className="text-sm text-muted-foreground">Total Rows</p>
                  <p className="text-lg font-semibold">{parsedData.length}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">Merchant Column</p>
                  <p className="text-lg font-semibold">{mapping.merchantName}</p>
                </div>
                {mapping.mid && (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">MID Column</p>
                    <p className="text-lg font-semibold">{mapping.mid}</p>
                  </div>
                )}
                {mapping.repEmail && (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">Rep Email Column</p>
                    <p className="text-lg font-semibold">{mapping.repEmail}</p>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm">
                  Only merchants that don't already exist in the system (by name or MID) will be added.
                  If rep email is mapped, merchants will be auto-assigned to matching reps.
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

        {/* Step: Processing / Complete */}
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
              {summary && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-primary/10 p-4 text-center">
                    <p className="text-2xl font-bold text-primary">{summary.added}</p>
                    <p className="text-sm text-muted-foreground">Added</p>
                  </div>
                  <div className="rounded-lg bg-muted p-4 text-center">
                    <p className="text-2xl font-bold text-muted-foreground">{summary.skipped}</p>
                    <p className="text-sm text-muted-foreground">Already Exist</p>
                  </div>
                  <div className="rounded-lg bg-destructive/10 p-4 text-center">
                    <p className="text-2xl font-bold text-destructive">{summary.errors}</p>
                    <p className="text-sm text-muted-foreground">Errors</p>
                  </div>
                </div>
              )}

              {processedAccounts.length > 0 && (
                <div className="space-y-2">
                  <Label>Results</Label>
                  <div className="max-h-64 overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Merchant</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedAccounts.map((acc, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{acc.merchantName}</p>
                                {acc.mid && <p className="text-xs text-muted-foreground">MID: {acc.mid}</p>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                acc.status === 'new' ? 'default' :
                                acc.status === 'exists' ? 'secondary' : 'destructive'
                              }>
                                {acc.status === 'new' ? 'Added' :
                                 acc.status === 'exists' ? 'Skipped' : 'Error'}
                              </Badge>
                              {acc.message && (
                                <p className="text-xs text-muted-foreground mt-1">{acc.message}</p>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate('/admin/merchants')} className="flex-1">
                  View Merchants
                </Button>
                <Button onClick={() => {
                  setStep('upload');
                  setFile(null);
                  setParsedData([]);
                  setHeaders([]);
                  setMapping({ merchantName: '', mid: '', repEmail: '' });
                  setProcessedAccounts([]);
                  setSummary(null);
                }} className="flex-1">
                  Upload Another
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
