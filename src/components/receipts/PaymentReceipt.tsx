import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SignaturePad } from '@/components/crm/SignaturePad';
import { Printer, Download, Check } from 'lucide-react';
import { Deal } from '@/integrations/aws/api';

export type ReceiptType = 'acv' | 'deductible' | 'depreciation';

interface PaymentReceiptProps {
  deal: Deal;
  repName: string;
  type: ReceiptType;
  onSave?: (signatureDataUrl: string, receiptData: ReceiptData) => void;
}

interface ReceiptData {
  type: ReceiptType;
  amount: number;
  paymentMethod: string;
  checkNumber: string;
  datePaid: string;
  signatureUrl?: string;
}

const receiptConfig: Record<ReceiptType, { title: string; description: string; fieldLabel: string }> = {
  acv: {
    title: 'ACV Payment Receipt',
    description: 'Actual Cash Value Payment',
    fieldLabel: 'ACV Amount',
  },
  deductible: {
    title: 'Deductible Payment Receipt',
    description: 'Homeowner Deductible Payment',
    fieldLabel: 'Deductible Amount',
  },
  depreciation: {
    title: 'Depreciation Payment Receipt',
    description: 'Depreciation/RCV Release Payment',
    fieldLabel: 'Depreciation Amount',
  },
};

export function PaymentReceipt({ deal, repName, type, onSave }: PaymentReceiptProps) {
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('Check');
  const [checkNumber, setCheckNumber] = useState('');
  const [logoBase64, setLogoBase64] = useState<string>('');
  const [amount, setAmount] = useState(() => {
    switch (type) {
      case 'acv': return deal.acv || 0;
      case 'deductible': return deal.deductible || 0;
      case 'depreciation': return deal.depreciation || 0;
      default: return 0;
    }
  });
  const [datePaid, setDatePaid] = useState(format(new Date(), 'yyyy-MM-dd'));
  const receiptRef = useRef<HTMLDivElement>(null);

  const config = receiptConfig[type];

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

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title>${config.title} - ${deal.homeowner_name}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 40px; 
              max-width: 800px; 
              margin: 0 auto;
              color: #333;
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
            .receipt-title { 
              font-size: 24px; 
              font-weight: bold; 
              text-align: center; 
              margin: 30px 0; 
              color: #0F1E2E;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .info-section { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 30px;
              padding: 20px;
              background: #f9f9f9;
              border-radius: 8px;
            }
            .info-group { 
              flex: 1;
            }
            .info-label { 
              font-size: 12px; 
              color: #666; 
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .info-value { 
              font-size: 16px; 
              font-weight: 500;
              color: #333;
            }
            .amount-section { 
              text-align: center; 
              padding: 30px; 
              background: #0F1E2E; 
              color: white; 
              border-radius: 8px;
              margin: 30px 0;
            }
            .amount-label { 
              font-size: 14px; 
              opacity: 0.8;
              margin-bottom: 10px;
            }
            .amount { 
              font-size: 48px; 
              font-weight: bold;
              color: #C9A24D;
            }
            .payment-details {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin: 30px 0;
              padding: 20px;
              border: 1px solid #ddd;
              border-radius: 8px;
            }
            .detail-item {
              padding: 10px 0;
            }
            .signature-section { 
              margin-top: 50px;
              padding-top: 30px;
              border-top: 1px solid #ddd;
            }
            .signature-row {
              display: flex;
              justify-content: space-between;
              gap: 40px;
              margin-top: 20px;
            }
            .signature-box { 
              flex: 1;
              text-align: center;
            }
            .signature-line { 
              border-bottom: 1px solid #333; 
              height: 60px; 
              margin-bottom: 10px;
              display: flex;
              align-items: flex-end;
              justify-content: center;
              padding-bottom: 5px;
            }
            .signature-line img {
              max-height: 50px;
              max-width: 200px;
            }
            .signature-label { 
              font-size: 12px; 
              color: #666;
            }
            .logo-img {
              max-width: 200px;
              max-height: 80px;
              margin-bottom: 10px;
            }
            .footer { 
              margin-top: 50px; 
              text-align: center; 
              font-size: 11px; 
              color: #999;
              padding-top: 20px;
              border-top: 1px solid #eee;
            }
            @media print {
              body { padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoBase64 ? `<img src="${logoBase64}" alt="Titan Prime Solutions" class="logo-img" />` : ''}
            <div class="logo">TITAN PRIME SOLUTIONS</div>
            <div class="subtitle">Professional Roofing & Construction</div>
          </div>
          
          <div class="receipt-title">${config.title}</div>
          
          <div class="info-section">
            <div class="info-group">
              <div class="info-label">Homeowner</div>
              <div class="info-value">${deal.homeowner_name}</div>
            </div>
            <div class="info-group">
              <div class="info-label">Property Address</div>
              <div class="info-value">${deal.address}</div>
              <div class="info-value" style="font-size: 14px; color: #666;">${deal.city || ''}, ${deal.state || ''} ${deal.zip_code || ''}</div>
            </div>
            <div class="info-group">
              <div class="info-label">Date</div>
              <div class="info-value">${format(new Date(datePaid), 'MMMM d, yyyy')}</div>
            </div>
          </div>
          
          <div class="amount-section">
            <div class="amount-label">${config.fieldLabel}</div>
            <div class="amount">$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          
          <div class="payment-details">
            <div class="detail-item">
              <div class="info-label">Payment Method</div>
              <div class="info-value">${paymentMethod}</div>
            </div>
            <div class="detail-item">
              <div class="info-label">Check/Reference #</div>
              <div class="info-value">${checkNumber || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="info-label">Insurance Company</div>
              <div class="info-value">${deal.insurance_company || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="info-label">Claim Number</div>
              <div class="info-value">${deal.claim_number || 'N/A'}</div>
            </div>
          </div>
          
          ${type === 'acv' ? `
          <div class="payment-details" style="margin-top: 20px;">
            <div style="grid-column: span 2; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Material Specifications</div>
            <div class="detail-item">
              <div class="info-label">Material Category</div>
              <div class="info-value">${deal.material_category || 'N/A'}</div>
            </div>
            ${(deal.material_category === 'Metal' || deal.material_category === 'Architectural Metal') ? `
            <div class="detail-item">
              <div class="info-label">Metal Type</div>
              <div class="info-value">${deal.material_type || 'N/A'}</div>
            </div>
            ` : ''}
            <div class="detail-item">
              <div class="info-label">Material Color</div>
              <div class="info-value">${deal.material_color || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="info-label">Drip Edge</div>
              <div class="info-value">${deal.drip_edge || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="info-label">Vent Color</div>
              <div class="info-value">${deal.vent_color || 'N/A'}</div>
            </div>
          </div>
          ` : ''}
          
          <div class="signature-section">
            <div class="info-label" style="text-align: center; margin-bottom: 10px;">ACKNOWLEDGEMENT OF PAYMENT</div>
            <p style="text-align: center; font-size: 13px; color: #666; margin-bottom: 30px;">
              By signing below, I acknowledge receipt of the above payment for services rendered.
            </p>
            <div class="signature-row">
              <div class="signature-box">
                <div class="signature-line">
                  ${signatureDataUrl ? `<img src="${signatureDataUrl}" alt="Signature" />` : ''}
                </div>
                <div class="signature-label">Homeowner Signature</div>
              </div>
              <div class="signature-box">
                <div class="signature-line">${format(new Date(datePaid), 'MM/dd/yyyy')}</div>
                <div class="signature-label">Date</div>
              </div>
            </div>
            <div class="signature-row" style="margin-top: 30px;">
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
            <p>Titan Prime Solutions</p>
            <p>This receipt serves as proof of payment. Please retain for your records.</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    // Wait for content to fully load before printing
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
    // Fallback if onload doesn't fire
    setTimeout(() => {
      printWindow.print();
    }, 1000);
  };

  const handleSave = () => {
    if (onSave && signatureDataUrl) {
      onSave(signatureDataUrl, {
        type,
        amount,
        paymentMethod,
        checkNumber,
        datePaid,
        signatureUrl: signatureDataUrl,
      });
    }
  };

  return (
    <Card className="border-2">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <span>{config.title}</span>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{config.description}</p>
      </CardHeader>
      <CardContent className="space-y-6" ref={receiptRef}>
        {/* Company Header */}
        <div className="text-center border-b pb-4">
          <h2 className="text-xl font-bold text-primary">TITAN PRIME SOLUTIONS</h2>
          <p className="text-sm text-muted-foreground">Professional Roofing & Construction</p>
        </div>

        {/* Homeowner Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground">Homeowner</Label>
            <p className="font-medium">{deal.homeowner_name}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Property Address</Label>
            <p className="font-medium">{deal.address}</p>
            {deal.city && (
              <p className="text-muted-foreground text-xs">{deal.city}, {deal.state} {deal.zip_code}</p>
            )}
          </div>
        </div>

        {/* Payment Details */}
        <div className="space-y-4 p-4 bg-muted rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">{config.fieldLabel}</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="text-lg font-bold"
              />
            </div>
            <div>
              <Label htmlFor="datePaid">Date Paid</Label>
              <Input
                id="datePaid"
                type="date"
                value={datePaid}
                onChange={(e) => setDatePaid(e.target.value)}
                className="h-10"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="paymentMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Check">Check</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Money Order">Money Order</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="checkNumber">Check/Reference #</Label>
              <Input
                id="checkNumber"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        </div>

        {/* Insurance Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground">Insurance Company</Label>
            <p className="font-medium">{deal.insurance_company || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Claim Number</Label>
            <p className="font-medium">{deal.claim_number || 'N/A'}</p>
          </div>
        </div>

        {/* Material Details - Only for ACV Receipt */}
        {type === 'acv' && (
          <div className="border rounded-lg p-4 space-y-3">
            <Label className="text-sm font-semibold">Material Specifications</Label>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground">Material Category</Label>
                <p className="font-medium">{deal.material_category || 'N/A'}</p>
              </div>
              {(deal.material_category === 'Metal' || deal.material_category === 'Architectural Metal') && (
                <div>
                  <Label className="text-xs text-muted-foreground">Metal Type</Label>
                  <p className="font-medium">{deal.material_type || 'N/A'}</p>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Material Color</Label>
                <p className="font-medium">{deal.material_color || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Drip Edge</Label>
                <p className="font-medium">{deal.drip_edge || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Vent Color</Label>
                <p className="font-medium">{deal.vent_color || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Rep Info */}
        <div className="p-3 bg-primary/10 rounded-lg">
          <Label className="text-xs text-muted-foreground">Sales Representative</Label>
          <p className="font-medium">{repName}</p>
        </div>

        {/* Signature Section */}
        <div className="space-y-3 pt-4 border-t">
          <Label>Homeowner Signature</Label>
          <p className="text-xs text-muted-foreground">
            By signing below, I acknowledge receipt of the above payment.
          </p>
          <SignaturePad onSignatureChange={setSignatureDataUrl} />
          {signatureDataUrl && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <Check className="w-4 h-4" />
              Signature captured
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={!signatureDataUrl}
            className="flex-1 gap-2"
          >
            <Download className="w-4 h-4" />
            Save Receipt
          </Button>
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
