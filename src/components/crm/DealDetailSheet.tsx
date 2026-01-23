import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { SignaturePad } from './SignaturePad';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { FileSignature, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

type DealStatus = 'lead' | 'signed' | 'permit' | 'install_scheduled' | 'installed' | 'complete' | 'paid' | 'cancelled';

interface Deal {
  id: string;
  homeowner_name: string;
  homeowner_phone: string | null;
  homeowner_email: string | null;
  address: string;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  status: DealStatus;
  total_price: number;
  signed_date: string | null;
  install_date: string | null;
  completion_date: string | null;
  created_at: string;
  contract_signed: boolean | null;
  signature_url: string | null;
  signature_date: string | null;
  notes: string | null;
  deal_commissions?: Array<{
    id: string;
    commission_type: string;
    commission_percent: number;
    commission_amount: number;
    paid: boolean;
  }>;
}

interface DealDetailSheetProps {
  deal: Deal | null;
  isOpen: boolean;
  onClose: () => void;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  lead: { label: 'Lead', color: 'bg-slate-500' },
  signed: { label: 'Signed', color: 'bg-blue-500' },
  permit: { label: 'Permit', color: 'bg-yellow-500' },
  install_scheduled: { label: 'Scheduled', color: 'bg-orange-500' },
  installed: { label: 'Installed', color: 'bg-teal-500' },
  complete: { label: 'Complete', color: 'bg-green-500' },
  paid: { label: 'Paid', color: 'bg-emerald-600' },
  cancelled: { label: 'Cancelled', color: 'bg-destructive' },
};

export function DealDetailSheet({ deal, isOpen, onClose }: DealDetailSheetProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    homeowner_name: '',
    homeowner_phone: '',
    homeowner_email: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    total_price: 0,
    notes: '',
  });

  // Reset form when deal changes
  useEffect(() => {
    if (deal) {
      setFormData({
        homeowner_name: deal.homeowner_name || '',
        homeowner_phone: deal.homeowner_phone || '',
        homeowner_email: deal.homeowner_email || '',
        address: deal.address || '',
        city: deal.city || '',
        state: deal.state || '',
        zip_code: deal.zip_code || '',
        total_price: deal.total_price || 0,
        notes: deal.notes || '',
      });
      setIsEditing(false);
      setSignatureDataUrl(null);
    }
  }, [deal]);

  const updateDealMutation = useMutation({
    mutationFn: async (updates: Partial<Deal> & { signatureDataUrl?: string }) => {
      const { signatureDataUrl: sigData, ...dealUpdates } = updates;
      
      // If there's a new signature, upload it first
      if (sigData && deal) {
        const base64Data = sigData.split(',')[1];
        const byteArray = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const blob = new Blob([byteArray], { type: 'image/png' });
        
        const fileName = `${deal.id}/signature-${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage
          .from('deal-signatures')
          .upload(fileName, blob, { contentType: 'image/png', upsert: true });
        
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('deal-signatures')
          .getPublicUrl(fileName);

        dealUpdates.signature_url = publicUrlData.publicUrl;
        dealUpdates.signature_date = new Date().toISOString();
        dealUpdates.contract_signed = true;
        dealUpdates.signed_date = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('deals')
        .update(dealUpdates)
        .eq('id', deal!.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Deal updated successfully');
      setIsEditing(false);
      setSignatureDataUrl(null);
    },
    onError: (error) => {
      toast.error('Failed to update deal: ' + error.message);
    },
  });

  const handleSave = () => {
    updateDealMutation.mutate({
      ...formData,
      signatureDataUrl: signatureDataUrl || undefined,
    });
  };

  const handleSignContract = () => {
    if (!signatureDataUrl) {
      toast.error('Please provide a signature');
      return;
    }
    updateDealMutation.mutate({ signatureDataUrl });
  };

  if (!deal) return null;

  const needsSignature = !deal.contract_signed;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Deal Details
            {deal.contract_signed && (
              <Badge variant="default" className="gap-1">
                <FileSignature className="w-3 h-3" />
                Signed
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status Banner */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
            <div className={`w-3 h-3 rounded-full ${statusConfig[deal.status]?.color}`} />
            <span className="font-medium">{statusConfig[deal.status]?.label}</span>
            {needsSignature && deal.status === 'lead' && (
              <Badge variant="outline" className="ml-auto gap-1 text-amber-600 border-amber-600">
                <AlertCircle className="w-3 h-3" />
                Needs Signature
              </Badge>
            )}
          </div>

          {/* Contract Signature Section - Always visible if not signed */}
          {needsSignature && (
            <div className="space-y-3 p-4 border border-warning bg-warning/10 rounded-lg">
              <div className="flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-warning" />
                <h3 className="font-semibold">
                  Contract Signature Required
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Have the homeowner sign below to proceed with the deal.
              </p>
              <SignaturePad onSignatureChange={setSignatureDataUrl} />
              <Button
                onClick={handleSignContract}
                disabled={!signatureDataUrl || updateDealMutation.isPending}
                className="w-full gap-2"
              >
                {updateDealMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Sign Contract
              </Button>
            </div>
          )}

          {/* Signed Contract Display */}
          {deal.contract_signed && deal.signature_url && (
            <div className="space-y-2 p-4 border border-primary/30 bg-primary/10 rounded-lg">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">
                  Contract Signed
                </h3>
              </div>
              {deal.signature_date && (
                <p className="text-sm text-muted-foreground">
                  Signed on {format(new Date(deal.signature_date), 'MMMM d, yyyy')}
                </p>
              )}
              <img
                src={deal.signature_url}
                alt="Signature"
                className="mt-2 max-h-20 border bg-background rounded"
              />
            </div>
          )}

          <Separator />

          {/* Editable Fields */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Homeowner Info
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </Button>
            </div>

            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="homeowner_name">Name</Label>
                  <Input
                    id="homeowner_name"
                    value={formData.homeowner_name}
                    onChange={(e) => setFormData({ ...formData, homeowner_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="homeowner_phone">Phone</Label>
                  <Input
                    id="homeowner_phone"
                    value={formData.homeowner_phone}
                    onChange={(e) => setFormData({ ...formData, homeowner_phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="homeowner_email">Email</Label>
                  <Input
                    id="homeowner_email"
                    type="email"
                    value={formData.homeowner_email}
                    onChange={(e) => setFormData({ ...formData, homeowner_email: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="font-medium">{deal.homeowner_name}</p>
                {deal.homeowner_phone && (
                  <p className="text-sm text-muted-foreground">{deal.homeowner_phone}</p>
                )}
                {deal.homeowner_email && (
                  <p className="text-sm text-muted-foreground">{deal.homeowner_email}</p>
                )}
              </div>
            )}
          </div>

          {/* Property Section */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Property
            </h3>
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="zip_code">Zip</Label>
                    <Input
                      id="zip_code"
                      value={formData.zip_code}
                      onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p className="font-medium">{deal.address}</p>
                <p className="text-sm text-muted-foreground">
                  {[deal.city, deal.state, deal.zip_code].filter(Boolean).join(', ')}
                </p>
              </div>
            )}
          </div>

          {/* Deal Value */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Deal Value
            </h3>
            {isEditing ? (
              <div>
                <Label htmlFor="total_price">Total Price ($)</Label>
                <Input
                  id="total_price"
                  type="number"
                  value={formData.total_price}
                  onChange={(e) => setFormData({ ...formData, total_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            ) : (
              <p className="text-2xl font-bold text-primary">
                ${deal.total_price?.toLocaleString() || '0'}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Notes
            </h3>
            {isEditing ? (
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add notes about this deal..."
                rows={3}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {deal.notes || 'No notes'}
              </p>
            )}
          </div>

          {/* Commissions */}
          {deal.deal_commissions && deal.deal_commissions.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Commissions
              </h3>
              <div className="space-y-2">
                {deal.deal_commissions.map((comm) => (
                  <div key={comm.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {comm.commission_type.replace('_', ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">{comm.commission_percent}%</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${comm.commission_amount.toLocaleString()}</p>
                      <Badge variant={comm.paid ? 'default' : 'secondary'} className="text-xs">
                        {comm.paid ? 'Paid' : 'Unpaid'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Timeline
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(deal.created_at), 'MMM d, yyyy')}</span>
              </div>
              {deal.signed_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Signed</span>
                  <span>{format(new Date(deal.signed_date), 'MMM d, yyyy')}</span>
                </div>
              )}
              {deal.install_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Install</span>
                  <span>{format(new Date(deal.install_date), 'MMM d, yyyy')}</span>
                </div>
              )}
              {deal.completion_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed</span>
                  <span>{format(new Date(deal.completion_date), 'MMM d, yyyy')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Save Button when editing */}
          {isEditing && (
            <Button
              onClick={handleSave}
              disabled={updateDealMutation.isPending}
              className="w-full gap-2"
            >
              {updateDealMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Save Changes
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
