import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Deal, dealsApi } from '@/integrations/aws/api';
import { Download, Save, CheckCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface InvoiceGeneratorProps {
  deal: Deal;
  onSave?: () => void;
}

export function InvoiceGenerator({ deal, onSave }: InvoiceGeneratorProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string>('');

  // Invoice fields - new format based on image
  const [workItems, setWorkItems] = useState(deal.invoice_work_items || '');
  const [totalAmount, setTotalAmount] = useState<number>(deal.invoice_amount || deal.rcv || deal.total_price || 0);

  // Track locally saved values so download works immediately after save
  const [savedLocally, setSavedLocally] = useState(false);

  const hasInvoice = savedLocally || !!deal.invoice_url || !!deal.invoice_sent_date;

  // Sync state with deal data when it changes (e.g., after refetch)
  useEffect(() => {
    if (deal.invoice_work_items) {
      setWorkItems(deal.invoice_work_items);
    }
    if (deal.invoice_amount) {
      setTotalAmount(deal.invoice_amount);
    }
  }, [deal.invoice_work_items, deal.invoice_amount]);

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

  const generateInvoiceHtml = (): string => {
    // Parse work items into numbered list
    const workItemsList = workItems
      .split('\n')
      .filter(item => item.trim())
      .map((item, index) => `<li>${item.trim()}</li>`)
      .join('\n');

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title>Final Invoice - ${deal.homeowner_name}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 40px; 
              max-width: 800px; 
              margin: 0 auto; 
              color: #000; 
              background: #fff;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #0F1E2E; 
              padding-bottom: 20px; 
              margin-bottom: 30px; 
            }
            .logo { 
              font-size: 28px; 
              font-weight: bold; 
              color: #0F1E2E; 
              margin-bottom: 5px;
            }
            .subtitle { 
              color: #C9A24D; 
              font-size: 14px; 
              margin-bottom: 10px;
            }
            .logo-img { 
              max-width: 200px; 
              max-height: 80px; 
              margin-bottom: 10px; 
            }
            .insured-info {
              margin-bottom: 20px;
              line-height: 1.6;
            }
            .insured-info strong {
              font-weight: bold;
            }
            .invoice-title {
              text-align: center;
              font-size: 20px;
              font-weight: bold;
              margin: 30px 0;
              color: #0F1E2E;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .work-list {
              margin: 20px 0;
              padding-left: 25px;
            }
            .work-list li {
              margin-bottom: 8px;
              line-height: 1.4;
            }
            .total-section {
              text-align: right;
              margin-top: 40px;
              font-weight: bold;
            }
            .total-amount {
              font-size: 18px;
              margin: 5px 0;
            }
            .all-work-complete {
              color: #f44336;
              font-weight: bold;
              font-size: 14px;
            }
            @media print {
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoBase64 ? `<img src="${logoBase64}" alt="Titan Prime Solutions" class="logo-img" />` : ''}
            <div class="logo">TITAN PRIME SOLUTIONS</div>
            <div class="subtitle">Professional Roofing & Construction</div>
          </div>
          
          <div class="insured-info">
            <div><strong>Insured:</strong> ${deal.homeowner_name} Cell: ${deal.homeowner_phone || 'N/A'}</div>
            <div><strong>Property:</strong> ${deal.address} E-mail: ${deal.homeowner_email || 'N/A'}</div>
            <div><strong>Home:</strong> ${deal.address}</div>
            <div>${deal.city?.toUpperCase() || ''}, ${deal.state?.toUpperCase() || ''} ${deal.zip_code || ''}</div>
            <div><strong>Claim Number:</strong> ${deal.claim_number || 'N/A'}</div>
            <div><strong>Insurance Company:</strong> ${deal.insurance_company || 'N/A'}</div>
          </div>
          
          <div class="invoice-title">Final Invoice</div>
          
          <ol class="work-list">
            ${workItemsList || '<li>No work items specified</li>'}
          </ol>
          
          <div class="total-section">
            <div>TOTAL</div>
            <div class="total-amount">$${(Number(totalAmount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="all-work-complete">ALL WORK COMPLETE</div>
          </div>
        </body>
      </html>
    `;
  };

  const handleDownload = async () => {
    const html = generateInvoiceHtml();
    const filename = `Invoice-${(deal.homeowner_name || 'Customer').replace(/\s+/g, '-')}.html`;

    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });

      // For iOS PWA, we need a different approach
      // Create a data URL and open it in a new tab/window
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

      if (isIOS && isStandalone) {
        // iOS PWA: open in new tab which allows saving
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
        window.open(dataUrl, '_blank');
        toast.success('Invoice opened - use Share to save');
        return;
      }

      // Try Web Share API first (works on iOS Safari and PWA)
      try {
        const file = new File([blob], filename, { type: 'text/html' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Invoice',
          });
          toast.success('Invoice shared');
          return;
        }
      } catch (shareError) {
        // Web Share API not supported or failed, continue to fallback
        console.log('Web Share not available, using download fallback');
      }

      // Fallback for desktop, Android, and when Web Share fails
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast.success('Invoice downloaded');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download invoice');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const invoiceHtml = generateInvoiceHtml();
      const invoiceDataUrl = 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(invoiceHtml)));

      const response = await dealsApi.update(deal.id, {
        invoice_url: invoiceDataUrl,
        invoice_sent_date: new Date().toISOString(),
        invoice_amount: Number(totalAmount) || 0,
        invoice_work_items: workItems,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      // Mark as saved locally so download works immediately
      setSavedLocally(true);

      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal', deal.id] });

      toast.success('Invoice saved!');
      onSave?.();
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  // Download saved invoice (uses the main handleDownload)
  const downloadSavedInvoice = handleDownload;

  if (hasInvoice) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Invoice Generated
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
            <div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                Invoice saved on {deal.invoice_sent_date ? format(new Date(deal.invoice_sent_date), 'MMM d, yyyy') : 'N/A'}
              </p>
              <p className="text-xs text-muted-foreground">
                Total: ${deal.invoice_amount?.toLocaleString() || '0'}
              </p>
            </div>
          </div>
          <Button variant="outline" className="w-full gap-2" onClick={downloadSavedInvoice}>
            <Download className="w-4 h-4" />
            Download Invoice
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Generate Invoice
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Work Items - Free Text Area */}
        <div className="space-y-2">
          <Label htmlFor="workItems">Work Items (one per line)</Label>
          <Textarea
            id="workItems"
            value={workItems}
            onChange={(e) => setWorkItems(e.target.value)}
            placeholder="Tear off, haul and dispose of comp. shingles - 3 tab
Roofing felt - 15 lb.
Drip edge
Asphalt starter - universal starter course
3 tab - 25 yr. - comp. shingle roofing - w/out felt
Hip / Ridge cap - cut from 3 tab - composition shingles
Flashing - pipe jack - split boot"
            rows={10}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Copy and paste work items from the loss statement. Each line will be numbered automatically.
          </p>
        </div>

        <Separator />

        {/* Total Amount */}
        <div className="space-y-2">
          <Label htmlFor="total">Total Amount</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="total"
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
              className="pl-7"
              step="0.01"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 gap-2" onClick={handleDownload}>
            <Download className="w-4 h-4" />
            Download
          </Button>
          <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Invoice'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
