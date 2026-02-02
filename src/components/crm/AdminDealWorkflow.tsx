import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Deal, DealStatus, dealsApi, pinsApi } from '@/integrations/aws/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { SecureDocumentLink } from '@/components/ui/SecureImage';
import { DocumentUpload, ImageUpload } from '@/components/uploads';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Loader2,
  Package,
  Truck,
  Calendar,
  DollarSign,
  CheckCircle2,
  User,
  FileSignature,
  Building2,
  MapPin,
  Phone,
  AlertTriangle,
  FileText,
  Receipt,
  Edit,
  Upload,
  ExternalLink,
  Mail,
  Clipboard,
  Camera,
  X,
  Clock,
  Download
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminDealWorkflowProps {
  deal: Deal;
  onUpdate: () => void;
}

// Simplified admin steps
const adminSteps = [
  { status: 'lead', label: 'Lead' },
  { status: 'signed', label: 'Ready' },
  { status: 'collect_acv', label: 'Collect ACV' },
  { status: 'collect_deductible', label: 'Collect Ded.' },
  { status: 'install_scheduled', label: 'Scheduled' },
  { status: 'installed', label: 'Installed' },
  { status: 'complete', label: 'Complete' },
];

function getStepIndex(status: DealStatus): number {
  // Map various statuses to simplified step index
  if (['lead', 'inspection_scheduled', 'claim_filed', 'adjuster_met'].includes(status)) return 0;
  if (status === 'signed') return 1;
  if (status === 'collect_acv') return 2;
  if (status === 'collect_deductible') return 3;
  if (status === 'install_scheduled') return 4;
  if (status === 'installed') return 5;
  if (status === 'complete') return 6;
  // Legacy statuses mapped to new flow
  if (status === 'materials_ordered') return 2;
  if (status === 'materials_delivered') return 3;
  if (status === 'adjuster_scheduled') return 0;
  return 0;
}

export function AdminDealWorkflow({ deal, onUpdate }: AdminDealWorkflowProps) {
  const queryClient = useQueryClient();
  const [installDate, setInstallDate] = useState(deal.install_date || '');
  const [adjusterMeetingDate, setAdjusterMeetingDate] = useState(deal.adjuster_meeting_date || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isEditingFinancials, setIsEditingFinancials] = useState(false);
  const [notes, setNotes] = useState(deal.notes || '');
  const [invoiceWorkItems, setInvoiceWorkItems] = useState(deal.invoice_work_items || '');

  // Editable financial fields
  const [rcv, setRcv] = useState(deal.rcv || 0);
  const [acv, setAcv] = useState(deal.acv || 0);
  const [depreciation, setDepreciation] = useState(deal.depreciation || 0);
  const [deductible, setDeductible] = useState(deal.deductible || 0);

  // Sync state when deal prop changes
  useEffect(() => {
    setInstallDate(deal.install_date || '');
    setAdjusterMeetingDate(deal.adjuster_meeting_date || '');
    setNotes(deal.notes || '');
    setInvoiceWorkItems(deal.invoice_work_items || '');
    setIsEditingNotes(false);
    setIsEditingFinancials(false);
    setRcv(deal.rcv || 0);
    setAcv(deal.acv || 0);
    setDepreciation(deal.depreciation || 0);
    setDeductible(deal.deductible || 0);
  }, [deal.id, deal.install_date, deal.adjuster_meeting_date, deal.notes, deal.invoice_work_items, deal.rcv, deal.acv, deal.depreciation, deal.deductible]);

  const currentStepIndex = getStepIndex(deal.status);
  const progress = Math.round(((currentStepIndex + 1) / adminSteps.length) * 100);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Deal>) => {
      const response = await dealsApi.update(deal.id, updates);
      if (response.error) throw new Error(response.error);

      // If marking as installed, also update associated pins
      if (updates.status === 'installed') {
        try {
          const pinsResponse = await pinsApi.list();
          if (pinsResponse.data) {
            const dealPins = pinsResponse.data.filter(pin => pin.deal_id === deal.id);
            for (const pin of dealPins) {
              await pinsApi.update(pin.id, { status: 'installed' });
            }
          }
        } catch (e) {
          console.warn('Could not update pins:', e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-all-pins'] });
      toast.success('Deal updated!');
      onUpdate();
    },
    onError: (error) => {
      toast.error('Failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    },
  });

  const updateDatesMutation = useMutation({
    mutationFn: async (updates: Partial<Deal>) => {
      const response = await dealsApi.update(deal.id, updates);
      if (response.error) throw new Error(response.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Dates updated!');
      onUpdate();
    },
    onError: (error) => {
      toast.error('Failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    },
  });

  const handleAction = (status: DealStatus, extras?: Partial<Deal>) => {
    const updates: Partial<Deal> = { status, ...extras };
    if (status === 'installed') updates.completion_date = new Date().toISOString().split('T')[0];
    updateMutation.mutate(updates);
  };

  // Determine next action
  const getNextAction = () => {
    switch (deal.status) {
      case 'signed':
        return { label: 'Collect ACV', icon: DollarSign, status: 'collect_acv' as DealStatus };
      case 'collect_acv':
        return { label: 'Collect Deductible', icon: DollarSign, status: 'collect_deductible' as DealStatus };
      case 'collect_deductible':
        return { label: 'Schedule Install', icon: Calendar, status: 'install_scheduled' as DealStatus };
      case 'install_scheduled':
        return { label: 'Mark Installed', icon: CheckCircle2, status: 'installed' as DealStatus };
      case 'installed':
        return { label: 'Mark Complete', icon: DollarSign, status: 'complete' as DealStatus };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();
  const isComplete = currentStepIndex >= 6;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <Badge variant={isComplete ? 'default' : 'outline'} className={isComplete ? 'bg-green-500' : ''}>
            {isComplete ? 'Complete' : `${progress}%`}
          </Badge>
        </div>
        <Progress value={progress} className="h-2" />

        {/* Mini step indicators */}
        <div className="flex justify-between">
          {adminSteps.map((step, i) => (
            <div key={step.status} className={cn(
              "w-2 h-2 rounded-full",
              i <= currentStepIndex ? "bg-primary" : "bg-muted"
            )} />
          ))}
        </div>
      </div>

      {/* Current Status */}
      <Card className={cn(
        "border-2",
        isComplete ? "border-green-500 bg-green-500/10" : "border-primary bg-primary/5"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Current Status</p>
              <p className="font-semibold text-lg">
                {adminSteps[currentStepIndex]?.label || deal.status}
              </p>
            </div>
            {isComplete && (
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Approval Type Section */}
      {(deal.status === 'adjuster_met' || deal.status === 'claim_filed' || deal.status === 'signed' ||
        (deal.contract_signed && !deal.approval_type)) && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium">Approval Status</span>
            </div>
            <Select
              value={deal.approval_type || ''}
              onValueChange={(value) => {
                updateMutation.mutate({
                  approval_type: value,
                  approved_date: new Date().toISOString()
                });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select approval type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full Approval</SelectItem>
                <SelectItem value="partial">Partial Approval</SelectItem>
                <SelectItem value="supplement_needed">Supplement Needed</SelectItem>
                <SelectItem value="sale">Sale (Homeowner Pays)</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Show current approval type if set */}
      {deal.approval_type && deal.approval_type !== 'supplement_needed' && (
        <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/30">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <div>
              <span className="text-sm font-medium text-green-600">
                {deal.approval_type === 'full' ? 'Full Approval' :
                  deal.approval_type === 'partial' ? 'Partial Approval' :
                  deal.approval_type === 'sale' ? 'Sale (Homeowner Pays)' : deal.approval_type}
              </span>
              {deal.approved_date && (
                <p className="text-xs text-muted-foreground">
                  {format(new Date(deal.approved_date), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => updateMutation.mutate({ approval_type: null, approved_date: null })}
          >
            Change
          </Button>
        </div>
      )}

      {/* Supplement Needed Warning */}
      {deal.approval_type === 'supplement_needed' && (
        <Card className="border-amber-500 bg-amber-500/10">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-600">Supplement Needed</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Cannot progress until supplement is approved.
            </p>
            <Select
              value=""
              onValueChange={(value) => {
                updateMutation.mutate({
                  approval_type: value,
                  approved_date: new Date().toISOString()
                });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Update when approved" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full Approval</SelectItem>
                <SelectItem value="partial">Partial Approval</SelectItem>
                <SelectItem value="sale">Sale (Homeowner Pays)</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Next Action */}
      {nextAction && (
        <div className="space-y-2">
          {['collect_deductible', 'install_scheduled'].includes(deal.status) && (
            <div className="space-y-1">
              <Label className="text-xs">Install Date (optional)</Label>
              <Input
                type="date"
                value={installDate}
                onChange={(e) => setInstallDate(e.target.value)}
                className="h-9"
              />
            </div>
          )}
          <Button
            onClick={() => handleAction(nextAction.status, installDate ? { install_date: installDate } : undefined)}
            disabled={updateMutation.isPending}
            className="w-full gap-2"
            size="lg"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <nextAction.icon className="w-4 h-4" />
            )}
            {nextAction.label}
          </Button>
        </div>
      )}

      {/* Quick Actions */}
      {!isComplete && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('collect_acv')}
            disabled={updateMutation.isPending || currentStepIndex >= 2}
            className="gap-1 text-xs"
          >
            <DollarSign className="w-3 h-3" />
            Collect ACV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('collect_deductible')}
            disabled={updateMutation.isPending || currentStepIndex < 2 || currentStepIndex >= 3}
            className="gap-1 text-xs"
          >
            <DollarSign className="w-3 h-3" />
            Collect Ded.
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('install_scheduled')}
            disabled={updateMutation.isPending || currentStepIndex < 3 || currentStepIndex >= 4}
            className="gap-1 text-xs"
          >
            <Calendar className="w-3 h-3" />
            Schedule
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('installed')}
            disabled={updateMutation.isPending || currentStepIndex < 4 || currentStepIndex >= 5}
            className="gap-1 text-xs"
          >
            <CheckCircle2 className="w-3 h-3" />
            Installed
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('complete')}
            disabled={updateMutation.isPending || currentStepIndex !== 5}
            className="gap-1 text-xs"
          >
            <DollarSign className="w-3 h-3" />
            Complete
          </Button>
        </div>
      )}

      {/* Scheduling */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Schedule Dates</h4>
        <div className="grid grid-cols-1 gap-3">
          {/* Install Date */}
          <div className="space-y-2">
            <Label className="text-xs">Install Date</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={installDate}
                onChange={(e) => setInstallDate(e.target.value)}
                className="h-9 flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateMutation.mutate({ install_date: installDate, status: 'install_scheduled' })}
                disabled={updateMutation.isPending || !installDate}
              >
                Schedule
              </Button>
            </div>
          </div>
          {/* Adjuster Meeting */}
          <div className="space-y-2">
            <Label className="text-xs">Adjuster Meeting Date</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={adjusterMeetingDate}
                onChange={(e) => setAdjusterMeetingDate(e.target.value)}
                className="h-9 flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateMutation.mutate({ status: 'adjuster_met', adjuster_meeting_date: adjusterMeetingDate })}
                disabled={updateMutation.isPending || !adjusterMeetingDate}
              >
                Met Adjuster
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Deal Info - Complete */}
      <div className="space-y-3 pt-2">
        <Separator />

        {/* Contact - Enhanced with quick actions */}
        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
          <User className="w-4 h-4 mt-0.5 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">{deal.homeowner_name}</p>
            <p className="text-xs text-muted-foreground truncate">{deal.address}</p>
            {deal.city && <p className="text-xs text-muted-foreground">{deal.city}, {deal.state} {deal.zip_code}</p>}

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 mt-2">
              {deal.homeowner_phone && (
                <a
                  href={`tel:${deal.homeowner_phone}`}
                  className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-1 rounded-full"
                >
                  <Phone className="w-3 h-3" />
                  {deal.homeowner_phone}
                </a>
              )}
              {deal.homeowner_email && (
                <a
                  href={`mailto:${deal.homeowner_email}`}
                  className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-1 rounded-full"
                >
                  <Mail className="w-3 h-3" />
                  Email
                </a>
              )}
              <button
                onClick={() => {
                  const fullAddress = `${deal.address}${deal.city ? `, ${deal.city}` : ''}${deal.state ? `, ${deal.state}` : ''} ${deal.zip_code || ''}`;
                  navigator.clipboard.writeText(fullAddress);
                  toast.success('Address copied!');
                }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full hover:bg-muted/80"
              >
                <Clipboard className="w-3 h-3" />
                Copy Address
              </button>
            </div>
          </div>
        </div>

        {/* Insurance & Adjuster */}
        {deal.insurance_company && (
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <Building2 className="w-4 h-4 mt-0.5 text-muted-foreground" />
            <div className="flex-1 space-y-1">
              <div className="flex justify-between">
                <span className="text-sm font-medium">{deal.insurance_company}</span>
              </div>
              {deal.claim_number && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Claim #</span>
                  <span className="font-mono">{deal.claim_number}</span>
                </div>
              )}
              {deal.policy_number && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Policy #</span>
                  <span className="font-mono">{deal.policy_number}</span>
                </div>
              )}
              {deal.adjuster_name && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Adjuster</span>
                  <span>{deal.adjuster_name}</span>
                </div>
              )}
              {deal.adjuster_phone && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Adjuster Phone</span>
                  <a href={`tel:${deal.adjuster_phone}`} className="text-primary">{deal.adjuster_phone}</a>
                </div>
              )}
              {deal.adjuster_meeting_date && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Meeting Date</span>
                  <span>{new Date(deal.adjuster_meeting_date).toLocaleDateString()}</span>
                </div>
              )}
              {deal.date_of_loss && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Date of Loss</span>
                  <span>{new Date(deal.date_of_loss).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Financials - Editable */}
        <div className="p-3 bg-green-500/10 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium">Financials</span>
            </div>
            {!isEditingFinancials && (
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setIsEditingFinancials(true)}>
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
            )}
          </div>

          {isEditingFinancials ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">RCV</Label>
                  <Input
                    type="number"
                    value={rcv}
                    onChange={(e) => setRcv(Number(e.target.value))}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">ACV</Label>
                  <Input
                    type="number"
                    value={acv}
                    onChange={(e) => setAcv(Number(e.target.value))}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Depreciation</Label>
                  <Input
                    type="number"
                    value={depreciation}
                    onChange={(e) => setDepreciation(Number(e.target.value))}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Deductible</Label>
                  <Input
                    type="number"
                    value={deductible}
                    onChange={(e) => setDeductible(Number(e.target.value))}
                    className="h-8"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setRcv(deal.rcv || 0);
                    setAcv(deal.acv || 0);
                    setDepreciation(deal.depreciation || 0);
                    setDeductible(deal.deductible || 0);
                    setIsEditingFinancials(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    updateMutation.mutate({ rcv, acv, depreciation, deductible });
                    setIsEditingFinancials(false);
                  }}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">RCV</span>
                <span className="font-bold text-green-600">${(deal.rcv || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">ACV</span>
                <span>${(deal.acv || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Depreciation</span>
                <span className="text-orange-600">${(deal.depreciation || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Deductible</span>
                <span>${(deal.deductible || 0).toLocaleString()}</span>
              </div>
              {deal.total_price > 0 && (
                <div className="flex justify-between text-xs pt-1 border-t border-border mt-1">
                  <span className="text-muted-foreground">Contract Total</span>
                  <span className="font-medium">${deal.total_price.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Property Details - Editable */}
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Property Details</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Roof Type</Label>
              <Select
                value={deal.roof_type || ''}
                onValueChange={(value) => updateMutation.mutate({ roof_type: value })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Shingle">Shingle</SelectItem>
                  <SelectItem value="Metal">Metal</SelectItem>
                  <SelectItem value="Tile">Tile</SelectItem>
                  <SelectItem value="Flat">Flat</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Squares</Label>
              <Input
                type="number"
                placeholder="0"
                value={deal.roof_squares || ''}
                onChange={(e) => updateMutation.mutate({ roof_squares: Number(e.target.value) || null })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Stories</Label>
              <Input
                type="number"
                placeholder="1"
                value={deal.stories || ''}
                onChange={(e) => updateMutation.mutate({ stories: Number(e.target.value) || null })}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Material Details - Editable */}
        <div className="p-3 bg-amber-500/10 rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium">Material Specifications</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Material Category</Label>
              <Select
                value={deal.material_category || ''}
                onValueChange={(value) => updateMutation.mutate({ material_category: value })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Single">Single</SelectItem>
                  <SelectItem value="Metal">Metal</SelectItem>
                  <SelectItem value="Architectural">Architectural</SelectItem>
                  <SelectItem value="Architectural Metal">Arch. Metal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(deal.material_category === 'Metal' || deal.material_category === 'Architectural Metal') && (
              <div className="space-y-1">
                <Label className="text-xs">Metal Type</Label>
                <Input
                  placeholder="Metal type"
                  value={deal.material_type || ''}
                  onChange={(e) => updateMutation.mutate({ material_type: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Material Color</Label>
              <Input
                placeholder="Color"
                value={deal.material_color || ''}
                onChange={(e) => updateMutation.mutate({ material_color: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Drip Edge</Label>
              <Input
                placeholder="Drip edge"
                value={deal.drip_edge || ''}
                onChange={(e) => updateMutation.mutate({ drip_edge: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vent Color</Label>
              <Input
                placeholder="Vent color"
                value={deal.vent_color || ''}
                onChange={(e) => updateMutation.mutate({ vent_color: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Lost Statement - Required for Full Approval - WITH UPLOAD */}
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Lost Statement</span>
            </div>
            {deal.lost_statement_url ? (
              <SecureDocumentLink src={deal.lost_statement_url} className="text-xs text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                View
              </SecureDocumentLink>
            ) : (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {deal.approval_type === 'full' ? 'Required' : 'Needed'}
              </Badge>
            )}
          </div>
          {!deal.lost_statement_url && (
            <DocumentUpload
              dealId={deal.id}
              category="lost-statements"
              label="Upload Lost Statement"
              onUpload={(url) => updateMutation.mutate({ lost_statement_url: url })}
            />
          )}
        </div>

        {/* Insurance Agreement - WITH UPLOAD */}
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Insurance Agreement</span>
            </div>
            {deal.insurance_agreement_url ? (
              <SecureDocumentLink src={deal.insurance_agreement_url} className="text-xs text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                View
              </SecureDocumentLink>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Not uploaded
              </Badge>
            )}
          </div>
          {!deal.insurance_agreement_url && (
            <DocumentUpload
              dealId={deal.id}
              category="insurance-agreements"
              label="Upload Insurance Agreement"
              onUpload={(url) => updateMutation.mutate({ insurance_agreement_url: url })}
            />
          )}
        </div>

        {/* Inspection Photos */}
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Inspection Photos</span>
            </div>
            {deal.inspection_images && deal.inspection_images.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {deal.inspection_images.length} photos
              </Badge>
            )}
          </div>
          <ImageUpload
            category="inspection-photos"
            dealId={deal.id}
            existingFiles={deal.inspection_images || []}
            label="Add Inspection Photos"
            onUpload={(url) => {
              const currentImages = deal.inspection_images || [];
              updateMutation.mutate({ inspection_images: [...currentImages, url] });
            }}
            onRemove={(url) => {
              const currentImages = deal.inspection_images || [];
              updateMutation.mutate({ inspection_images: currentImages.filter(u => u !== url) });
            }}
          />
        </div>

        {/* Install Photos */}
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Install Photos</span>
            </div>
            {deal.install_images && deal.install_images.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {deal.install_images.length} photos
              </Badge>
            )}
          </div>
          <ImageUpload
            category="install-photos"
            dealId={deal.id}
            existingFiles={deal.install_images || []}
            label="Add Install Photos"
            onUpload={(url) => {
              const currentImages = deal.install_images || [];
              updateMutation.mutate({ install_images: [...currentImages, url] });
            }}
            onRemove={(url) => {
              const currentImages = deal.install_images || [];
              updateMutation.mutate({ install_images: currentImages.filter(u => u !== url) });
            }}
          />
        </div>

        {/* Completion Photos */}
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Completion Photos</span>
            </div>
            {deal.completion_images && deal.completion_images.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {deal.completion_images.length} photos
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
              updateMutation.mutate({ completion_images: [...currentImages, url] });
            }}
            onRemove={(url) => {
              const currentImages = deal.completion_images || [];
              updateMutation.mutate({ completion_images: currentImages.filter(u => u !== url) });
            }}
          />
        </div>

        {/* Permit Upload */}
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Permit</span>
            </div>
            {deal.permit_file_url ? (
              <div className="flex items-center gap-2">
                <SecureDocumentLink src={deal.permit_file_url} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  View
                </SecureDocumentLink>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => updateMutation.mutate({ permit_file_url: null })}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Not uploaded
              </Badge>
            )}
          </div>
          {!deal.permit_file_url && (
            <DocumentUpload
              dealId={deal.id}
              category="permits"
              label="Upload Permit"
              onUpload={(url) => updateMutation.mutate({ permit_file_url: url })}
            />
          )}
        </div>

        {/* Contract Status */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">Contract</span>
          </div>
          {deal.contract_signed ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500 text-xs">Signed</Badge>
              {deal.signed_date && (
                <span className="text-xs text-muted-foreground">
                  {format(new Date(deal.signed_date), 'MMM d')}
                </span>
              )}
            </div>
          ) : (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Not Signed
            </Badge>
          )}
        </div>

        {/* Signature Preview */}
        {deal.signature_url && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">Signature</p>
            <img src={deal.signature_url} alt="Signature" className="max-h-16 border rounded bg-white" />
          </div>
        )}

        {/* Timeline - Enhanced Visual */}
        <div className="p-3 bg-muted/50 rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Deal Timeline</span>
          </div>
          <div className="relative pl-4 border-l-2 border-muted-foreground/20 space-y-3">
            {/* Created */}
            <div className="relative">
              <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-blue-500" />
              <div className="flex justify-between text-xs">
                <span className="font-medium">Deal Created</span>
                <span className="text-muted-foreground">{format(new Date(deal.created_at), 'MMM d, yyyy')}</span>
              </div>
            </div>

            {/* Inspection Photos */}
            {deal.inspection_images && deal.inspection_images.length > 0 && (
              <div className="relative">
                <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-purple-500" />
                <div className="flex justify-between text-xs">
                  <span className="font-medium">Inspection Completed</span>
                  <span className="text-muted-foreground">{deal.inspection_images.length} photos</span>
                </div>
              </div>
            )}

            {/* Claim Filed */}
            {deal.claim_number && (
              <div className="relative">
                <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-indigo-500" />
                <div className="flex justify-between text-xs">
                  <span className="font-medium">Claim Filed</span>
                  <span className="text-muted-foreground">#{deal.claim_number}</span>
                </div>
              </div>
            )}

            {/* Adjuster Meeting */}
            {deal.adjuster_meeting_date && (
              <div className="relative">
                <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-pink-500" />
                <div className="flex justify-between text-xs">
                  <span className="font-medium">Adjuster Met</span>
                  <span className="text-muted-foreground">{format(new Date(deal.adjuster_meeting_date), 'MMM d, yyyy')}</span>
                </div>
              </div>
            )}

            {/* Approved */}
            {deal.approval_type && deal.approved_date && (
              <div className="relative">
                <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-teal-500" />
                <div className="flex justify-between text-xs">
                  <span className="font-medium">
                    {deal.approval_type === 'full' ? 'Full Approval' :
                     deal.approval_type === 'partial' ? 'Partial Approval' :
                     deal.approval_type === 'sale' ? 'Sale Approval' : 'Approved'}
                  </span>
                  <span className="text-muted-foreground">{format(new Date(deal.approved_date), 'MMM d, yyyy')}</span>
                </div>
              </div>
            )}

            {/* Contract Signed */}
            {deal.signed_date && (
              <div className="relative">
                <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-green-500" />
                <div className="flex justify-between text-xs">
                  <span className="font-medium">Contract Signed</span>
                  <span className="text-muted-foreground">{format(new Date(deal.signed_date), 'MMM d, yyyy')}</span>
                </div>
              </div>
            )}

            {/* ACV Collected */}
            {deal.acv_check_date && (
              <div className="relative">
                <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-orange-500" />
                <div className="flex justify-between text-xs">
                  <span className="font-medium">ACV Check Collected</span>
                  <span className="text-muted-foreground">{format(new Date(deal.acv_check_date), 'MMM d, yyyy')}</span>
                </div>
              </div>
            )}

            {/* Install Scheduled */}
            {deal.install_date && (
              <div className="relative">
                <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-cyan-500" />
                <div className="flex justify-between text-xs">
                  <span className="font-medium">Install Date</span>
                  <span className="text-muted-foreground">{format(new Date(deal.install_date), 'MMM d, yyyy')}</span>
                </div>
              </div>
            )}

            {/* Install Photos */}
            {deal.install_images && deal.install_images.length > 0 && (
              <div className="relative">
                <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-teal-600" />
                <div className="flex justify-between text-xs">
                  <span className="font-medium">Installed</span>
                  <span className="text-muted-foreground">{deal.install_images.length} photos</span>
                </div>
              </div>
            )}

            {/* Invoice Sent */}
            {deal.invoice_sent_date && (
              <div className="relative">
                <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-violet-500" />
                <div className="flex justify-between text-xs">
                  <span className="font-medium">Invoice Sent</span>
                  <span className="text-muted-foreground">{format(new Date(deal.invoice_sent_date), 'MMM d, yyyy')}</span>
                </div>
              </div>
            )}

            {/* Depreciation Collected */}
            {deal.depreciation_check_date && (
              <div className="relative">
                <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-amber-500" />
                <div className="flex justify-between text-xs">
                  <span className="font-medium">Depreciation Collected</span>
                  <span className="text-muted-foreground">{format(new Date(deal.depreciation_check_date), 'MMM d, yyyy')}</span>
                </div>
              </div>
            )}

            {/* Completed */}
            {deal.completion_date && (
              <div className="relative">
                <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-emerald-500" />
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-green-600">Completed</span>
                  <span className="text-green-600">{format(new Date(deal.completion_date), 'MMM d, yyyy')}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rep Info */}
        {deal.deal_commissions && deal.deal_commissions.length > 0 && (
          <div className="flex items-start gap-3 p-3 bg-blue-500/10 rounded-lg">
            <User className="w-4 h-4 mt-0.5 text-blue-600" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Assigned Rep</p>
              {deal.deal_commissions.map((comm, i) => (
                <div key={comm.id || i} className="flex justify-between text-xs">
                  <span>{comm.rep_name || `Rep ${i + 1}`}</span>
                  <span className="text-muted-foreground">{comm.commission_percent}% - ${comm.commission_amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Receipts Section */}
        {(deal.acv_receipt_url || deal.deductible_receipt_url || deal.depreciation_receipt_url) && (
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <Receipt className="w-4 h-4 mt-0.5 text-muted-foreground" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium">Receipts</p>
              <div className="flex flex-wrap gap-2">
                {deal.acv_receipt_url && (
                  <SecureDocumentLink src={deal.acv_receipt_url} className="text-xs text-primary hover:underline flex items-center gap-1 bg-background px-2 py-1 rounded border">
                    <Receipt className="w-3 h-3" />
                    ACV Receipt
                  </SecureDocumentLink>
                )}
                {deal.deductible_receipt_url && (
                  <SecureDocumentLink src={deal.deductible_receipt_url} className="text-xs text-primary hover:underline flex items-center gap-1 bg-background px-2 py-1 rounded border">
                    <Receipt className="w-3 h-3" />
                    Deductible
                  </SecureDocumentLink>
                )}
                {deal.depreciation_receipt_url && (
                  <SecureDocumentLink src={deal.depreciation_receipt_url} className="text-xs text-primary hover:underline flex items-center gap-1 bg-background px-2 py-1 rounded border">
                    <Receipt className="w-3 h-3" />
                    Depreciation
                  </SecureDocumentLink>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Invoice Section - Enhanced with Download */}
        <div className="p-3 bg-indigo-500/10 rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium">Invoice</span>
          </div>

          {deal.invoice_amount && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">${deal.invoice_amount.toLocaleString()}</span>
            </div>
          )}
          {deal.invoice_sent_date && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Sent</span>
              <span>{format(new Date(deal.invoice_sent_date), 'MMM d, yyyy')}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {deal.invoice_url && (
              <SecureDocumentLink src={deal.invoice_url} className="text-xs text-primary hover:underline flex items-center gap-1 bg-background px-2 py-1 rounded border">
                <ExternalLink className="w-3 h-3" />
                View Invoice
              </SecureDocumentLink>
            )}

            {/* Generate/Download Invoice Button */}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => window.location.href = `/deals/${deal.id}/receipts`}
            >
              <Download className="w-3 h-3" />
              {deal.invoice_url ? 'Regenerate' : 'Generate Invoice'}
            </Button>
          </div>
        </div>

        {/* Invoice Work Items */}
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clipboard className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Invoice Work Items</span>
            </div>
          </div>
          <Textarea
            placeholder="Enter work items for invoice (e.g., Remove existing shingles, Install new underlayment...)"
            value={invoiceWorkItems}
            onChange={(e) => setInvoiceWorkItems(e.target.value)}
            className="min-h-[80px] text-sm"
          />
          {invoiceWorkItems !== (deal.invoice_work_items || '') && (
            <Button
              size="sm"
              onClick={() => updateMutation.mutate({ invoice_work_items: invoiceWorkItems })}
              disabled={updateMutation.isPending}
              className="w-full"
            >
              {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              Save Work Items
            </Button>
          )}
        </div>

        {/* Notes - Editable */}
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">Notes</p>
            {!isEditingNotes && (
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setIsEditingNotes(true)}>
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
            )}
          </div>
          {isEditingNotes ? (
            <div className="space-y-2">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[80px] text-sm"
                placeholder="Add notes about this deal..."
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setNotes(deal.notes || '');
                    setIsEditingNotes(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    updateMutation.mutate({ notes });
                    setIsEditingNotes(false);
                  }}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm">{deal.notes || <span className="text-muted-foreground italic">No notes</span>}</p>
          )}
        </div>
      </div>
    </div>
  );
}
