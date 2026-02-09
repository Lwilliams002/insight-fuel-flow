import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { SignaturePad } from './SignaturePad';
import { InvoiceGenerator, InspectionReportGenerator } from '@/components/receipts';
import { DocumentUpload, ImageUpload } from '@/components/uploads';
import { SecureImage, SecureDocumentLink } from '@/components/ui/SecureImage';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  FileSignature, 
  Check, 
  AlertCircle, 
  Loader2, 
  Upload, 
  Calendar, 
  FileText, 
  Camera,
  DollarSign,
  X,
  Image,
  Package,
  Truck,
  Wrench,
  CheckCircle2,
  Receipt,
  ChevronRight,
  UserPlus
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Deal, DealStatus, dealsApi, repsApi, Rep } from '@/integrations/aws/api';
import { calculateDealStatus, getProgressionRequirements, dealStatusConfig } from '@/lib/crmProcess';
import { RepDealWorkflow } from './RepDealWorkflow';
import { AdminDealWorkflow } from './AdminDealWorkflow';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DealDetailSheetProps {
  deal: Deal | null;
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  // SIGN PHASE
  lead: { label: 'Lead', color: 'bg-slate-500' },
  inspection_scheduled: { label: 'Inspection Scheduled', color: 'bg-indigo-500' },
  claim_filed: { label: 'Claim Filed', color: 'bg-purple-500' },
  adjuster_met: { label: 'Awaiting Approval', color: 'bg-rose-500' },
  approved: { label: 'Approved', color: 'bg-teal-500' },
  signed: { label: 'Signed', color: 'bg-blue-500' },
  // BUILD PHASE
  collect_acv: { label: 'Collect ACV', color: 'bg-orange-400' },
  collect_deductible: { label: 'Collect Deductible', color: 'bg-orange-500' },
  install_scheduled: { label: 'Scheduled', color: 'bg-amber-500' },
  installed: { label: 'Installed', color: 'bg-teal-500' },
  // COLLECT PHASE
  invoice_sent: { label: 'RCV Sent', color: 'bg-indigo-500' },
  depreciation_collected: { label: 'Depreciation Collected', color: 'bg-teal-600' },
  complete: { label: 'Complete', color: 'bg-green-500' },
  // OTHER
  cancelled: { label: 'Cancelled', color: 'bg-destructive' },
  on_hold: { label: 'On Hold', color: 'bg-gray-500' },
  // LEGACY
  permit: { label: 'Permit', color: 'bg-yellow-500' },
  pending: { label: 'Payment Pending', color: 'bg-amber-500' },
  paid: { label: 'Paid', color: 'bg-emerald-600' },
  materials_ordered: { label: 'Materials Ordered', color: 'bg-orange-400' },
  materials_delivered: { label: 'Materials Delivered', color: 'bg-orange-500' },
  adjuster_scheduled: { label: 'Adjuster Scheduled', color: 'bg-pink-500' },
};

export function DealDetailSheet({ deal, isOpen, onClose, isAdmin = false }: DealDetailSheetProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [uploadingPermit, setUploadingPermit] = useState(false);
  const [uploadingInstall, setUploadingInstall] = useState(false);
  const [uploadingCompletion, setUploadingCompletion] = useState(false);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [selectedRepId, setSelectedRepId] = useState<string>('');

  const permitInputRef = useRef<HTMLInputElement>(null);
  const installInputRef = useRef<HTMLInputElement>(null);
  const completionInputRef = useRef<HTMLInputElement>(null);

  // Fetch reps list for reassignment (only for admin)
  const { data: repsData } = useQuery({
    queryKey: ['reps'],
    queryFn: async () => {
      const response = await repsApi.list();
      return response.data || [];
    },
    enabled: isAdmin && isOpen,
  });

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
    install_date: '',
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
        install_date: deal.install_date || '',
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

      // Merge updates with current deal data for status calculation
      const mergedDeal = { ...deal, ...dealUpdates };

      // Auto-calculate the status based on the deal's data
      const calculatedStatus = calculateDealStatus(mergedDeal);

      // Only update status if it would progress forward (not go backwards)
      const currentStepNumber = dealStatusConfig[deal!.status]?.stepNumber || 0;
      const newStepNumber = dealStatusConfig[calculatedStatus]?.stepNumber || 0;

      if (newStepNumber > currentStepNumber) {
        dealUpdates.status = calculatedStatus;

        // Set timestamp for the new milestone
        const timestampField = `${calculatedStatus.replace(/-/g, '_')}_date`;
        if (!mergedDeal[timestampField as keyof typeof mergedDeal]) {
          (dealUpdates as Record<string, unknown>)[timestampField] = new Date().toISOString();
        }
      }

      // Use the AWS API to update
      const response = await dealsApi.update(deal!.id, dealUpdates);
      if (response.error) {
        throw new Error(response.error);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal', deal?.id] });
      toast.success('Deal updated successfully');
      setIsEditing(false);
      setSignatureDataUrl(null);
    },
    onError: (error) => {
      toast.error('Failed to update deal: ' + error.message);
    },
  });

  // Mutation to reassign deal to another rep
  const reassignDealMutation = useMutation({
    mutationFn: async (newRepId: string) => {
      if (!deal) throw new Error('No deal selected');

      // Get the new rep's details
      const repResponse = await repsApi.get(newRepId);
      if (repResponse.error) throw new Error(repResponse.error);
      const newRep = repResponse.data;

      // Update deal_commissions - remove existing and add new
      // First, we need to update the commission record in the database
      const { data: existingCommissions, error: fetchError } = await supabase
        .from('deal_commissions')
        .select('*')
        .eq('deal_id', deal.id);

      if (fetchError) throw fetchError;

      // If there are existing commissions, update the first one
      if (existingCommissions && existingCommissions.length > 0) {
        const { error: updateError } = await supabase
          .from('deal_commissions')
          .update({ rep_id: newRepId })
          .eq('deal_id', deal.id);

        if (updateError) throw updateError;
      } else {
        // Create a new commission record
        const { error: insertError } = await supabase
          .from('deal_commissions')
          .insert({
            deal_id: deal.id,
            rep_id: newRepId,
            commission_type: 'closer',
            commission_percent: newRep?.default_commission_percent || 10,
            commission_amount: 0,
            paid: false
          });

        if (insertError) throw insertError;
      }

      return newRep;
    },
    onSuccess: (newRep) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deal', deal?.id] });
      toast.success(`Deal reassigned to ${newRep?.full_name || 'new rep'}`);
      setShowReassignDialog(false);
      setSelectedRepId('');
    },
    onError: (error) => {
      toast.error('Failed to reassign deal: ' + error.message);
    },
  });

  const handleSave = () => {
    updateDealMutation.mutate({
      ...formData,
      install_date: formData.install_date || null,
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

  const handlePermitUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !deal) return;

    setUploadingPermit(true);
    try {
      const fileName = `${deal.id}/permit-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('deal-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('deal-documents')
        .getPublicUrl(fileName);

      await supabase.from('deals').update({ permit_file_url: publicUrlData.publicUrl }).eq('id', deal.id);
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Permit uploaded successfully');
    } catch (error: unknown) {
      toast.error('Failed to upload permit: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setUploadingPermit(false);
    }
  };

  const handleImagesUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'install' | 'completion'
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !deal) return;

    const setUploading = type === 'install' ? setUploadingInstall : setUploadingCompletion;
    const columnName = type === 'install' ? 'install_images' : 'completion_images';
    const existingImages = (type === 'install' ? deal.install_images : deal.completion_images) || [];

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      
      for (const file of Array.from(files)) {
        const fileName = `${deal.id}/${type}-${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('deal-documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('deal-documents')
          .getPublicUrl(fileName);
        
        uploadedUrls.push(publicUrlData.publicUrl);
      }

      const allImages = [...existingImages, ...uploadedUrls];
      await supabase.from('deals').update({ [columnName]: allImages }).eq('id', deal.id);
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success(`${type === 'install' ? 'Installation' : 'Completion'} images uploaded`);
    } catch (error: unknown) {
      toast.error('Failed to upload images: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleRequestPayment = async () => {
    if (!deal) return;
    
    try {
      // Keep status as 'complete' but set payment_requested flag
      await supabase.from('deals').update({
        payment_requested: true,
        payment_requested_at: new Date().toISOString(),
      }).eq('id', deal.id);
      
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Payment request sent to admin');
    } catch (error: unknown) {
      toast.error('Failed to request payment: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const removeImage = async (type: 'install' | 'completion', urlToRemove: string) => {
    if (!deal) return;
    
    const columnName = type === 'install' ? 'install_images' : 'completion_images';
    const existingImages = (type === 'install' ? deal.install_images : deal.completion_images) || [];
    const updatedImages = existingImages.filter(url => url !== urlToRemove);

    try {
      await supabase.from('deals').update({ [columnName]: updatedImages }).eq('id', deal.id);
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Image removed');
    } catch (error: unknown) {
      toast.error('Failed to remove image');
    }
  };

  if (!deal) return null;

  const needsSignature = !deal.contract_signed;
  const needsInstallDate = !deal.install_date;
  const needsPermit = !deal.permit_file_url;
  const needsInstallImages = !deal.install_images || deal.install_images.length === 0;
  const needsCompletionImages = !deal.completion_images || deal.completion_images.length === 0;
  const canRequestPayment = deal.status === 'complete' && !deal.payment_requested;

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
            {deal.payment_requested && deal.status !== 'paid' && (
              <Badge variant="outline" className="ml-auto gap-1 text-amber-600 border-amber-600">
                <DollarSign className="w-3 h-3" />
                Pay Requested
              </Badge>
            )}
          </div>

          {/* Admin: Reassign to Rep Button */}
          {isAdmin && (
            <div className="space-y-2">
              {deal.deal_commissions && deal.deal_commissions.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Currently assigned to:</span>
                  <Badge variant="secondary">
                    {deal.deal_commissions[0].rep_name || 'Unknown Rep'}
                  </Badge>
                </div>
              )}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setShowReassignDialog(true)}
              >
                <UserPlus className="w-4 h-4" />
                Reassign to Another Rep
              </Button>
            </div>
          )}

          {/* Rep Workflow - Show guided steps for non-admins */}
          {!isAdmin && (
            <RepDealWorkflow deal={deal} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['deals'] })} />
          )}

          {/* Admin Workflow - Show user-friendly admin interface */}
          {isAdmin && (
            <AdminDealWorkflow deal={deal} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['deals'] })} />
          )}

          {/* Contract Signature Section - Always visible if not signed */}
          {needsSignature && (
            <div className="space-y-3 p-4 border border-warning bg-warning/10 rounded-lg">
              <div className="flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-warning" />
                <h3 className="font-semibold">Contract Signature Required</h3>
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
                <h3 className="font-semibold">Contract Signed</h3>
              </div>
              {deal.signature_date && (
                <p className="text-sm text-muted-foreground">
                  Signed on {format(new Date(deal.signature_date), 'MMMM d, yyyy')}
                </p>
              )}
              <SecureImage
                src={deal.signature_url}
                alt="Signature"
                className="mt-2 max-h-20 border bg-background rounded"
              />
            </div>
          )}

          {/* Insurance Agreement Upload */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Insurance Agreement
              </h3>
            </div>
            {deal.insurance_agreement_url ? (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileText className="w-5 h-5 text-primary" />
                <SecureDocumentLink
                  src={deal.insurance_agreement_url}
                  className="text-sm text-primary hover:underline flex-1 truncate"
                >
                  View Insurance Agreement
                </SecureDocumentLink>
                <Check className="w-4 h-4 text-primary" />
              </div>
            ) : (
              <DocumentUpload
                category="insurance-agreements"
                dealId={deal.id}
                label="Upload Insurance Agreement"
                onUpload={(url) => {
                  updateDealMutation.mutate({ insurance_agreement_url: url });
                }}
              />
            )}
          </div>

          {/* Approval Type Section - Show when awaiting approval */}
          {(deal.status === 'adjuster_met' || deal.status === 'claim_filed' ||
            (deal.contract_signed && !deal.approval_type && !deal.approved_date)) && (
            <div className="space-y-3 p-4 border border-amber-500 bg-amber-500/10 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold">Approval Status</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Select the approval type once insurance approves the claim.
              </p>
              <Select
                value={deal.approval_type || ''}
                onValueChange={(value) => {
                  updateDealMutation.mutate({
                    approval_type: value,
                    approved_date: new Date().toISOString()
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select approval type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Approval</SelectItem>
                  <SelectItem value="partial">Partial Approval</SelectItem>
                  <SelectItem value="supplement_needed">Supplement Needed (Cannot Progress)</SelectItem>
                  <SelectItem value="sale">Sale (Homeowner Pays)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Show Approval Type if already set - Green for approved types */}
          {deal.approval_type && deal.approval_type !== 'supplement_needed' && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  {deal.approval_type === 'full' ? 'Full Approval' :
                    deal.approval_type === 'partial' ? 'Partial Approval' :
                    deal.approval_type === 'sale' ? 'Sale (Homeowner Pays)' : deal.approval_type}
                </p>
                {deal.approved_date && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(deal.approved_date), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateDealMutation.mutate({ approval_type: null, approved_date: null })}
              >
                Change
              </Button>
            </div>
          )}

          {/* Show Supplement Needed warning */}
          {deal.approval_type === 'supplement_needed' && (
            <div className="space-y-3 p-4 border border-amber-500 bg-amber-500/10 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-600">Supplement Needed</h3>
                  <p className="text-xs text-muted-foreground">
                    Cannot progress until supplement is approved
                  </p>
                </div>
              </div>
              <Select
                value=""
                onValueChange={(value) => {
                  updateDealMutation.mutate({
                    approval_type: value,
                    approved_date: new Date().toISOString()
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Supplement approved? Update status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Approval</SelectItem>
                  <SelectItem value="partial">Partial Approval</SelectItem>
                  <SelectItem value="sale">Sale (Homeowner Pays)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Next Steps Guide */}
          <div className="space-y-2 p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Next Step</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {getProgressionRequirements(deal.status as DealStatus)[0] || 'Complete current step'}
            </p>
          </div>

          {/* Material Specifications Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Material Specifications
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Material Category</Label>
                <Select
                  value={deal.material_category || ''}
                  onValueChange={(value) => updateDealMutation.mutate({ material_category: value })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single">Single</SelectItem>
                    <SelectItem value="Metal">Metal</SelectItem>
                    <SelectItem value="Architectural">Architectural</SelectItem>
                    <SelectItem value="Architectural Metal">Architectural Metal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(deal.material_category === 'Metal' || deal.material_category === 'Architectural Metal') && (
                <div className="space-y-1">
                  <Label className="text-xs">Metal Type</Label>
                  <Input
                    placeholder="Enter metal type"
                    value={deal.material_type || ''}
                    onChange={(e) => updateDealMutation.mutate({ material_type: e.target.value })}
                    className="h-9"
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Material Color</Label>
                <Input
                  placeholder="Enter color"
                  value={deal.material_color || ''}
                  onChange={(e) => updateDealMutation.mutate({ material_color: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Drip Edge</Label>
                <Input
                  placeholder="Enter drip edge"
                  value={deal.drip_edge || ''}
                  onChange={(e) => updateDealMutation.mutate({ drip_edge: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vent Color</Label>
                <Input
                  placeholder="Enter vent color"
                  value={deal.vent_color || ''}
                  onChange={(e) => updateDealMutation.mutate({ vent_color: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* Lost Statement Upload - Required for Full Approval */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Lost Statement
              </h3>
              {deal.approval_type === 'full' && !deal.lost_statement_url && (
                <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-600">
                  <AlertCircle className="w-3 h-3" />
                  Required for Full Approval
                </Badge>
              )}
            </div>
            {deal.lost_statement_url ? (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileText className="w-5 h-5 text-primary" />
                <SecureDocumentLink
                  src={deal.lost_statement_url}
                  className="text-sm text-primary hover:underline flex-1 truncate"
                >
                  View Lost Statement
                </SecureDocumentLink>
                <Check className="w-4 h-4 text-primary" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateDealMutation.mutate({ lost_statement_url: null })}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <DocumentUpload
                category="lost-statements"
                dealId={deal.id}
                label="Upload Lost Statement"
                onUpload={(url) => {
                  updateDealMutation.mutate({ lost_statement_url: url });
                }}
              />
            )}
          </div>

          <Separator />

          {/* Install Date Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Install Date
              </h3>
              {needsInstallDate && (
                <Badge variant="outline" className="text-xs gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Required for Scheduled
                </Badge>
              )}
            </div>
            <Input
              type="date"
              value={formData.install_date}
              onChange={(e) => {
                const value = e.target.value;
                setFormData({ ...formData, install_date: value });
                updateDealMutation.mutate({ install_date: value || null });
              }}
            />
          </div>

          {/* Permit Upload Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Permit Document
              </h3>
            </div>
            {deal.permit_file_url ? (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileText className="w-5 h-5 text-primary" />
                <SecureDocumentLink
                  src={deal.permit_file_url}
                  className="text-sm text-primary hover:underline flex-1 truncate"
                >
                  View Permit
                </SecureDocumentLink>
                <Check className="w-4 h-4 text-primary" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateDealMutation.mutate({ permit_file_url: null })}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <DocumentUpload
                category="permits"
                dealId={deal.id}
                label="Upload Permit"
                onUpload={(url) => {
                  updateDealMutation.mutate({ permit_file_url: url });
                }}
              />
            )}
          </div>

          {/* Payment Receipts Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Payment Receipts
              </h3>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => window.location.href = `/deals/${deal.id}/receipts`}
            >
              <Receipt className="w-4 h-4" />
              Create Payment Receipt
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Generate ACV, Deductible, or Depreciation receipts
            </p>
          </div>

          {/* Invoice Section - Admin Only, Show after install photos */}
          {isAdmin && (deal.status === 'installed' || deal.status === 'invoice_sent' ||
            deal.status === 'depreciation_collected' || deal.status === 'complete' ||
            (deal.install_images && deal.install_images.length > 0)) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Invoice
                </h3>
                <Badge variant="outline" className="text-xs">Admin Only</Badge>
              </div>
              <InvoiceGenerator
                deal={deal}
                onSave={() => {
                  queryClient.invalidateQueries({ queryKey: ['deals'] });
                }}
              />
            </div>
          )}

          {/* Inspection Photos Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Inspection Photos
              </h3>
            </div>
            <ImageUpload
              category="inspection-photos"
              dealId={deal.id}
              existingFiles={deal.inspection_images || []}
              label="Add Inspection Photos"
              onUpload={(url) => {
                const currentImages = deal.inspection_images || [];
                updateDealMutation.mutate({ inspection_images: [...currentImages, url] });
              }}
              onRemove={(url) => {
                const currentImages = deal.inspection_images || [];
                updateDealMutation.mutate({ inspection_images: currentImages.filter(u => u !== url) });
              }}
            />
          </div>

          {/* Inspection Report Generator - Show when inspection photos exist */}
          {deal.inspection_images && deal.inspection_images.length > 0 && (
            <div className="space-y-3">
              <InspectionReportGenerator deal={deal} />
            </div>
          )}

          {/* Install Images Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Installation Photos
              </h3>
              {needsInstallImages && (
                <Badge variant="outline" className="text-xs gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Required for Installed
                </Badge>
              )}
            </div>
            <ImageUpload
              category="install-photos"
              dealId={deal.id}
              existingFiles={deal.install_images || []}
              label="Add Installation Photos"
              onUpload={(url) => {
                const currentImages = deal.install_images || [];
                updateDealMutation.mutate({ install_images: [...currentImages, url] });
              }}
              onRemove={(url) => {
                const currentImages = deal.install_images || [];
                updateDealMutation.mutate({ install_images: currentImages.filter(u => u !== url) });
              }}
            />
          </div>

          {/* Completion Images Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Image className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Completion Photos
              </h3>
              {needsCompletionImages && (
                <Badge variant="outline" className="text-xs gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Required for Complete
                </Badge>
              )}
            </div>
            <ImageUpload
              category="completion-photos"
              dealId={deal.id}
              existingFiles={deal.completion_images || []}
              label="Add Completion Photos"
              onUpload={(url) => {
                const currentImages = deal.completion_images || [];
                updateDealMutation.mutate({ completion_images: [...currentImages, url] });
              }}
              onRemove={(url) => {
                const currentImages = deal.completion_images || [];
                updateDealMutation.mutate({ completion_images: currentImages.filter(u => u !== url) });
              }}
            />
          </div>

          {/* Request Payment Button */}
          {canRequestPayment && (
            <div className="space-y-3 p-4 border border-primary bg-primary/10 rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Ready for Payment</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Submit a payment request for admin approval.
              </p>
              <Button onClick={handleRequestPayment} className="w-full gap-2">
                <DollarSign className="w-4 h-4" />
                Request Payment
              </Button>
            </div>
          )}

          {deal.payment_requested && deal.status !== 'paid' && (
            <div className="p-4 border border-amber-500 bg-amber-500/10 rounded-lg">
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
                <h3 className="font-semibold text-amber-700">Payment Pending</h3>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Your payment request is awaiting admin approval.
              </p>
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

      {/* Reassign Rep Dialog */}
      <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Deal to Rep</DialogTitle>
            <DialogDescription>
              Select a rep to reassign this deal to. The new rep will be able to manage the deal and receive commissions.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Select Rep</Label>
            <Select value={selectedRepId} onValueChange={setSelectedRepId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select a rep..." />
              </SelectTrigger>
              <SelectContent>
                {repsData?.filter(rep => rep.active).map((rep) => (
                  <SelectItem key={rep.id} value={rep.id}>
                    {rep.full_name} ({rep.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReassignDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => reassignDealMutation.mutate(selectedRepId)}
              disabled={!selectedRepId || reassignDealMutation.isPending}
            >
              {reassignDealMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              Reassign Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
