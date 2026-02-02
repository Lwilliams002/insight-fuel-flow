import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaymentReceipt, ReceiptType } from './PaymentReceipt';
import { Deal, dealsApi } from '@/integrations/aws/api';
import { FileText, DollarSign, Receipt, CheckCircle, Eye, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';

interface ReceiptSheetProps {
  deal: Deal;
  repName: string;
  onReceiptSaved?: (type: ReceiptType, signatureUrl: string) => void;
  trigger?: React.ReactNode;
}

export function ReceiptSheet({ deal, repName, onReceiptSaved, trigger }: ReceiptSheetProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ReceiptType>('acv');
  const [saving, setSaving] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string>('');
  const queryClient = useQueryClient();

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
    const config = {
      acv: { title: 'ACV Payment Receipt', description: 'Actual Cash Value Payment' },
      deductible: { title: 'Deductible Payment Receipt', description: 'Homeowner Deductible Payment' },
      depreciation: { title: 'Depreciation Payment Receipt', description: 'Depreciation/RCV Release Payment' },
    };
    const { title, description } = config[type];

    return `
      <!DOCTYPE html>
      <html>
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
            <h3>Acknowledgment</h3>
            <p style="font-size: 14px; color: #666;">
              By signing below, I acknowledge receipt of the above payment.
            </p>
            <div class="signature-row">
              <div class="signature-box">
                <img src="${signatureDataUrl}" alt="Signature" class="signature-img" />
                <div class="signature-label">Homeowner Signature</div>
              </div>
              <div class="signature-box">
                <div class="signature-line">${repName}</div>
                <div class="signature-label">Sales Representative</div>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <p>Titan Prime Solutions</p>
            <p>This receipt serves as proof of payment. Please retain for your records.</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;
  };

  const handleSave = async (signatureDataUrl: string, receiptData: {
    type: ReceiptType;
    amount: number;
    datePaid: string;
    paymentMethod?: string;
    checkNumber?: string;
  }) => {
    setSaving(true);

    try {
      // Generate the full receipt HTML
      const receiptHtml = generateReceiptHtml(
        receiptData.type,
        signatureDataUrl,
        receiptData.amount,
        receiptData.datePaid,
        receiptData.paymentMethod || 'Check',
        receiptData.checkNumber || ''
      );

      // Convert receipt HTML to a data URL for storage
      const receiptDataUrl = 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(receiptHtml)));

      // Determine which field to update based on receipt type
      const updateData: Partial<Deal> = {};

      switch (receiptData.type) {
        case 'acv':
          // Store the full receipt HTML (not just signature)
          updateData.acv_receipt_url = receiptDataUrl;
          updateData.acv_check_collected = true;
          updateData.acv_check_amount = receiptData.amount;
          updateData.acv_check_date = receiptData.datePaid;
          updateData.collect_acv_date = new Date().toISOString();
          break;
        case 'deductible':
          updateData.deductible_receipt_url = receiptDataUrl;
          updateData.collect_deductible_date = new Date().toISOString();
          break;
        case 'depreciation':
          updateData.depreciation_receipt_url = receiptDataUrl;
          updateData.depreciation_check_collected = true;
          updateData.depreciation_check_amount = receiptData.amount;
          updateData.depreciation_check_date = receiptData.datePaid;
          updateData.depreciation_collected_date = new Date().toISOString();
          break;
      }

      // Save to the deal via API
      const response = await dealsApi.update(deal.id, updateData);

      if (response.error) {
        throw new Error(response.error);
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal', deal.id] });

      toast.success(`${receiptData.type.toUpperCase()} Receipt saved successfully!`);

      if (onReceiptSaved) {
        onReceiptSaved(receiptData.type, receiptDataUrl);
      }

      // Close the sheet after successful save
      setOpen(false);
    } catch (error) {
      console.error('Error saving receipt:', error);
      toast.error('Failed to save receipt. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Check if receipt already exists
  const hasAcvReceipt = !!deal.acv_receipt_url;
  const hasDeductibleReceipt = !!deal.deductible_receipt_url;
  const hasDepreciationReceipt = !!deal.depreciation_receipt_url;

  // Helper to open receipt in new window for printing
  const openReceiptForPrint = (receiptUrl: string, title: string) => {
    if (!receiptUrl) return;

    // If it's a data URL with HTML content
    if (receiptUrl.startsWith('data:text/html;base64,')) {
      const htmlContent = decodeURIComponent(escape(atob(receiptUrl.replace('data:text/html;base64,', ''))));
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        // Delay print to allow content to load
        setTimeout(() => printWindow.print(), 500);
      }
    } else if (receiptUrl.startsWith('data:image')) {
      // Legacy signature-only format
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head><title>${title}</title></head>
            <body style="text-align:center;padding:40px;">
              <h1>${title}</h1>
              <img src="${receiptUrl}" style="max-width:100%;" />
            </body>
          </html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
      }
    }
  };

  // Helper to download receipt as HTML file
  const downloadReceipt = async (receiptUrl: string, title: string) => {
    if (!receiptUrl) return;

    try {
      let htmlContent = '';
      const filename = `${title}-${deal.homeowner_name.replace(/\s+/g, '-')}.html`;

      if (receiptUrl.startsWith('data:text/html;base64,')) {
        htmlContent = decodeURIComponent(escape(atob(receiptUrl.replace('data:text/html;base64,', ''))));
      } else if (receiptUrl.startsWith('data:image')) {
        htmlContent = `
          <html>
            <head><title>${title}</title></head>
            <body style="text-align:center;padding:40px;">
              <h1>${title}</h1>
              <img src="${receiptUrl}" style="max-width:100%;" />
            </body>
          </html>
        `;
      }

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });

      // Try Web Share API first (works on iOS Safari and PWA)
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
        // Web Share API not supported or failed, continue to fallback
        console.log('Web Share not available, using download fallback');
      }

      // Fallback for desktop, Android, and when Web Share fails
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

  // Render receipt preview in iframe
  const ReceiptPreview = ({ receiptUrl, title }: { receiptUrl: string; title: string }) => {
    if (receiptUrl.startsWith('data:text/html;base64,')) {
      const htmlContent = decodeURIComponent(escape(atob(receiptUrl.replace('data:text/html;base64,', ''))));
      return (
        <iframe
          srcDoc={htmlContent}
          className="w-full h-[500px] border rounded-lg bg-white"
          title={title}
        />
      );
    } else if (receiptUrl.startsWith('data:image')) {
      return (
        <div className="p-4 bg-white rounded-lg">
          <img src={receiptUrl} alt={title} className="max-w-full" />
        </div>
      );
    }
    return <p className="text-muted-foreground">Unable to preview receipt</p>;
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Receipt className="w-4 h-4" />
            Create Receipt
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Payment Receipts
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReceiptType)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="acv" className="gap-1 text-xs">
                {hasAcvReceipt ? <CheckCircle className="w-3 h-3 text-green-500" /> : <DollarSign className="w-3 h-3" />}
                ACV
              </TabsTrigger>
              <TabsTrigger value="deductible" className="gap-1 text-xs">
                {hasDeductibleReceipt ? <CheckCircle className="w-3 h-3 text-green-500" /> : <DollarSign className="w-3 h-3" />}
                Deductible
              </TabsTrigger>
              <TabsTrigger value="depreciation" className="gap-1 text-xs">
                {hasDepreciationReceipt ? <CheckCircle className="w-3 h-3 text-green-500" /> : <DollarSign className="w-3 h-3" />}
                Depreciation
              </TabsTrigger>
            </TabsList>

            <TabsContent value="acv" className="mt-4">
              {hasAcvReceipt && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600 dark:text-green-400 flex-1">ACV Receipt saved</span>
                    <span className="text-xs text-muted-foreground">
                      ${deal.acv_check_amount?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 gap-1">
                          <Eye className="w-3 h-3" />
                          View Receipt
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center justify-between">
                            <span>ACV Payment Receipt</span>
                            <DialogClose asChild>
                              <Button variant="ghost" size="sm">
                                <X className="w-4 h-4" />
                              </Button>
                            </DialogClose>
                          </DialogTitle>
                        </DialogHeader>
                        <ReceiptPreview receiptUrl={deal.acv_receipt_url!} title="ACV Payment Receipt" />
                        <div className="pt-4 border-t">
                          <Button
                            variant="outline"
                            className="w-full gap-2 mb-2"
                            onClick={() => downloadReceipt(deal.acv_receipt_url!, 'ACV-Payment-Receipt')}
                          >
                            <Download className="w-4 h-4" />
                            Download Receipt
                          </Button>
                        </div>
                        <DialogClose asChild>
                          <Button className="w-full" variant="secondary">
                            Close
                          </Button>
                        </DialogClose>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              )}
              <PaymentReceipt
                deal={deal}
                repName={repName}
                type="acv"
                onSave={handleSave}
              />
            </TabsContent>

            <TabsContent value="deductible" className="mt-4">
              {hasDeductibleReceipt && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600 dark:text-green-400 flex-1">Deductible Receipt saved</span>
                    <span className="text-xs text-muted-foreground">
                      ${deal.deductible?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 gap-1">
                          <Eye className="w-3 h-3" />
                          View Receipt
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center justify-between">
                            <span>Deductible Payment Receipt</span>
                            <DialogClose asChild>
                              <Button variant="ghost" size="sm">
                                <X className="w-4 h-4" />
                              </Button>
                            </DialogClose>
                          </DialogTitle>
                        </DialogHeader>
                        <ReceiptPreview receiptUrl={deal.deductible_receipt_url!} title="Deductible Payment Receipt" />
                        <div className="pt-4 border-t">
                          <Button
                            variant="outline"
                            className="w-full gap-2 mb-2"
                            onClick={() => downloadReceipt(deal.deductible_receipt_url!, 'Deductible-Payment-Receipt')}
                          >
                            <Download className="w-4 h-4" />
                            Download Receipt
                          </Button>
                        </div>
                        <DialogClose asChild>
                          <Button className="w-full" variant="secondary">
                            Close
                          </Button>
                        </DialogClose>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              )}
              <PaymentReceipt
                deal={deal}
                repName={repName}
                type="deductible"
                onSave={handleSave}
              />
            </TabsContent>

            <TabsContent value="depreciation" className="mt-4">
              {hasDepreciationReceipt && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600 dark:text-green-400 flex-1">Depreciation Receipt saved</span>
                    <span className="text-xs text-muted-foreground">
                      ${deal.depreciation_check_amount?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 gap-1">
                          <Eye className="w-3 h-3" />
                          View Receipt
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center justify-between">
                            <span>Depreciation Payment Receipt</span>
                            <DialogClose asChild>
                              <Button variant="ghost" size="sm">
                                <X className="w-4 h-4" />
                              </Button>
                            </DialogClose>
                          </DialogTitle>
                        </DialogHeader>
                        <ReceiptPreview receiptUrl={deal.depreciation_receipt_url!} title="Depreciation Payment Receipt" />
                        <div className="pt-4 border-t">
                          <Button
                            variant="outline"
                            className="w-full gap-2 mb-2"
                            onClick={() => downloadReceipt(deal.depreciation_receipt_url!, 'Depreciation-Payment-Receipt')}
                          >
                            <Download className="w-4 h-4" />
                            Download Receipt
                          </Button>
                        </div>
                        <DialogClose asChild>
                          <Button className="w-full" variant="secondary">
                            Close
                          </Button>
                        </DialogClose>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              )}
              <PaymentReceipt
                deal={deal}
                repName={repName}
                type="depreciation"
                onSave={handleSave}
              />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
