import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaymentReceipt, ReceiptType } from '@/components/receipts/PaymentReceipt';
import { Deal, dealsApi } from '@/integrations/aws/api';
import { ArrowLeft, FileText, DollarSign, Receipt, CheckCircle, Eye, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAwsAuth } from '@/contexts/AwsAuthContext';

export default function ReceiptPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAwsAuth();

  const initialTab = (searchParams.get('type') as ReceiptType) || 'acv';
  const [activeTab, setActiveTab] = useState<ReceiptType>(initialTab);
  const [saving, setSaving] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string>('');
  const [viewingReceipt, setViewingReceipt] = useState<{ type: ReceiptType; url: string } | null>(null);

  // Fetch deal data
  const { data: deal, isLoading, error } = useQuery({
    queryKey: ['deal', dealId],
    queryFn: async () => {
      if (!dealId) throw new Error('No deal ID');
      const response = await dealsApi.get(dealId);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    enabled: !!dealId,
  });

  // Get rep name from deal commissions or user profile (must be after deal query)
  const repName = deal?.deal_commissions?.[0]?.rep_name || user?.fullName || user?.email?.split('@')[0] || 'Sales Rep';

  // Load logo as base64 on mount
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const response = await fetch('/logo.png');
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoBase64(reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        console.error('Failed to load logo:', e);
      }
    };
    loadLogo();
  }, []);

  // Generate the full receipt HTML for storage and viewing
  const generateReceiptHtml = (
    type: ReceiptType,
    signatureDataUrl: string,
    amount: number,
    datePaid: string,
    paymentMethod: string,
    checkNumber: string
  ): string => {
    if (!deal) return '';

    const config = {
      acv: { title: 'ACV Payment Receipt', description: 'Actual Cash Value Payment' },
      deductible: { title: 'Deductible Payment Receipt', description: 'Homeowner Deductible Payment' },
      depreciation: { title: 'Depreciation Payment Receipt', description: 'Depreciation/RCV Release Payment' },
    };
    const { title, description } = config[type];

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title>${title} - ${deal.homeowner_name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #0F1E2E; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 28px; font-weight: bold; color: #0F1E2E; margin-bottom: 5px; }
            .logo-img { max-width: 200px; max-height: 80px; margin-bottom: 10px; }
            .subtitle { color: #C9A24D; font-size: 14px; margin-bottom: 10px; }
            .receipt-title { font-size: 20px; color: #333; margin-top: 15px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .info-item { padding: 15px; background: #f5f5f5; border-radius: 8px; }
            .info-label { font-size: 12px; color: #666; margin-bottom: 5px; }
            .info-value { font-size: 16px; font-weight: 600; color: #333; }
            .amount-box { text-align: center; padding: 30px; background: #0F1E2E; color: white; border-radius: 10px; margin: 20px 0; }
            .amount-label { font-size: 14px; opacity: 0.8; }
            .amount-value { font-size: 36px; font-weight: bold; color: #C9A24D; }
            .signature-section { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
            .signature-row { display: flex; gap: 30px; margin-top: 30px; }
            .signature-box { flex: 1; }
            .signature-img { max-width: 200px; height: auto; border-bottom: 2px solid #333; }
            .signature-line { border-bottom: 2px solid #333; padding-bottom: 10px; min-height: 50px; font-weight: 600; }
            .signature-label { font-size: 12px; color: #666; margin-top: 5px; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoBase64 ? `<img src="${logoBase64}" alt="Titan Prime Solutions" class="logo-img" />` : ''}
            <div class="logo">TITAN PRIME SOLUTIONS</div>
            <div class="subtitle">Professional Roofing & Construction</div>
            <div class="receipt-title">${title}</div>
          </div>
          
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Homeowner</div>
              <div class="info-value">${deal.homeowner_name}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Date</div>
              <div class="info-value">${new Date(datePaid).toLocaleDateString()}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Property Address</div>
              <div class="info-value">${deal.address || ''}, ${deal.city || ''}, ${deal.state || ''} ${deal.zip_code || ''}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Payment Method</div>
              <div class="info-value">${paymentMethod}${checkNumber ? ' #' + checkNumber : ''}</div>
            </div>
          </div>
          
          <div class="amount-box">
            <div class="amount-label">${description}</div>
            <div class="amount-value">$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          
          <div class="signature-section">
            <h3>Payment Confirmation</h3>
            <p>I acknowledge receipt of the above payment for roofing services.</p>
            <div class="signature-row">
              <div class="signature-box">
                <div class="signature-line">
                  ${signatureDataUrl ? `<img src="${signatureDataUrl}" class="signature-img" alt="Homeowner Signature" />` : ''}
                </div>
                <div class="signature-label">Homeowner Signature</div>
              </div>
              <div class="signature-box">
                <div class="signature-line">${new Date(datePaid).toLocaleDateString()}</div>
                <div class="signature-label">Date</div>
              </div>
            </div>
            <div class="signature-row">
              <div class="signature-box">
                <div class="signature-line">${repName}</div>
                <div class="signature-label">Sales Representative</div>
              </div>
              <div class="signature-box">
                <div class="signature-line">Titan Prime Solutions</div>
                <div class="signature-label">Company</div>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <p>Titan Prime Solutions - Professional Roofing & Construction</p>
            <p>This receipt serves as proof of payment. Please retain for your records.</p>
          </div>
        </body>
      </html>
    `;
  };

  // Handle saving the receipt
  const handleSaveReceipt = async (
    signatureDataUrl: string,
    receiptData: {
      type: ReceiptType;
      amount: number;
      paymentMethod: string;
      checkNumber: string;
      datePaid: string;
    }
  ) => {
    if (!deal) return;

    setSaving(true);
    try {
      const receiptHtml = generateReceiptHtml(
        receiptData.type,
        signatureDataUrl,
        receiptData.amount,
        receiptData.datePaid,
        receiptData.paymentMethod,
        receiptData.checkNumber
      );

      const receiptDataUrl = 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(receiptHtml)));

      const updateData: Partial<Deal> = {};

      if (receiptData.type === 'acv') {
        updateData.acv_receipt_url = receiptDataUrl;
        updateData.acv_check_collected = true;
        updateData.acv_check_amount = receiptData.amount;
        updateData.acv_check_date = receiptData.datePaid;
        updateData.collect_acv_date = new Date().toISOString();
      } else if (receiptData.type === 'deductible') {
        updateData.deductible_receipt_url = receiptDataUrl;
        updateData.collect_deductible_date = new Date().toISOString();
      } else if (receiptData.type === 'depreciation') {
        updateData.depreciation_receipt_url = receiptDataUrl;
        updateData.depreciation_check_collected = true;
        updateData.depreciation_check_amount = receiptData.amount;
        updateData.depreciation_check_date = receiptData.datePaid;
        updateData.depreciation_collected_date = new Date().toISOString();
      }

      const response = await dealsApi.update(deal.id, updateData);

      if (response.error) {
        throw new Error(response.error);
      }

      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal', deal.id] });

      toast.success(`${receiptData.type.toUpperCase()} receipt saved!`);

      // Navigate back to deal details
      navigate(`/deals/${deal.id}`);
    } catch (error) {
      console.error('Error saving receipt:', error);
      toast.error('Failed to save receipt');
    } finally {
      setSaving(false);
    }
  };

  // Download receipt
  const downloadReceipt = async (receiptUrl: string, title: string) => {
    if (!receiptUrl || !deal) return;

    try {
      let htmlContent = '';
      const filename = `${title}-${deal.homeowner_name.replace(/\s+/g, '-')}.html`;

      if (receiptUrl.startsWith('data:text/html;base64,')) {
        htmlContent = decodeURIComponent(escape(atob(receiptUrl.replace('data:text/html;base64,', ''))));
      }

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });

      try {
        const file = new File([blob], filename, { type: 'text/html' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: title,
          });
          toast.success('Receipt shared');
          return;
        }
      } catch (shareError) {
        console.log('Web Share not available, using download fallback');
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast.success('Receipt downloaded');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download receipt');
    }
  };

  // Check if receipt exists
  const hasReceipt = (type: ReceiptType): boolean => {
    if (!deal) return false;
    switch (type) {
      case 'acv': return !!deal.acv_receipt_url;
      case 'deductible': return !!deal.deductible_receipt_url;
      case 'depreciation': return !!deal.depreciation_receipt_url;
      default: return false;
    }
  };

  const getReceiptUrl = (type: ReceiptType): string | null => {
    if (!deal) return null;
    switch (type) {
      case 'acv': return deal.acv_receipt_url || null;
      case 'deductible': return deal.deductible_receipt_url || null;
      case 'depreciation': return deal.depreciation_receipt_url || null;
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load deal</p>
          <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // If viewing a saved receipt
  if (viewingReceipt) {
    let htmlContent = '';
    if (viewingReceipt.url.startsWith('data:text/html;base64,')) {
      htmlContent = decodeURIComponent(escape(atob(viewingReceipt.url.replace('data:text/html;base64,', ''))));
    }

    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background border-b p-4 pt-safe flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewingReceipt(null)}
            className="flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadReceipt(viewingReceipt.url, `${viewingReceipt.type.toUpperCase()}-Receipt`)}
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
        <iframe
          srcDoc={htmlContent}
          className="w-full h-[calc(100vh-60px)] border-0 bg-white"
          title="Receipt Preview"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b p-4 pt-safe flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Payment Receipts</h1>
          <p className="text-xs text-muted-foreground">{deal?.homeowner_name}</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-20">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReceiptType)}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="acv" className="flex items-center gap-1 text-xs">
              <DollarSign className="w-3 h-3" />
              ACV
              {hasReceipt('acv') && <CheckCircle className="w-3 h-3 text-green-500" />}
            </TabsTrigger>
            <TabsTrigger value="deductible" className="flex items-center gap-1 text-xs">
              <Receipt className="w-3 h-3" />
              Deductible
              {hasReceipt('deductible') && <CheckCircle className="w-3 h-3 text-green-500" />}
            </TabsTrigger>
            <TabsTrigger value="depreciation" className="flex items-center gap-1 text-xs">
              <FileText className="w-3 h-3" />
              Depreciation
              {hasReceipt('depreciation') && <CheckCircle className="w-3 h-3 text-green-500" />}
            </TabsTrigger>
          </TabsList>

          {(['acv', 'deductible', 'depreciation'] as ReceiptType[]).map((type) => (
            <TabsContent key={type} value={type} className="space-y-4">
              {hasReceipt(type) ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      {type.toUpperCase()} Receipt Saved
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      This receipt has been saved. You can view or download it below.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setViewingReceipt({ type, url: getReceiptUrl(type)! })}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => downloadReceipt(getReceiptUrl(type)!, `${type.toUpperCase()}-Receipt`)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <PaymentReceipt
                  deal={deal}
                  repName={repName}
                  type={type}
                  onSave={(signatureDataUrl, receiptData) => handleSaveReceipt(signatureDataUrl, receiptData)}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
