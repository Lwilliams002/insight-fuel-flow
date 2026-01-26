import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Deal, DealStatus, dealsApi, pinsApi } from '@/integrations/aws/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
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
  AlertTriangle
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
  { status: 'materials_ordered', label: 'Ordered' },
  { status: 'materials_delivered', label: 'Delivered' },
  { status: 'installed', label: 'Installed' },
  { status: 'complete', label: 'Complete' },
];

function getStepIndex(status: DealStatus): number {
  // Map various statuses to simplified step index
  if (['lead', 'inspection_scheduled', 'claim_filed', 'adjuster_scheduled'].includes(status)) return 0;
  if (status === 'signed') return 1;
  if (status === 'materials_ordered') return 2;
  if (status === 'materials_delivered' || status === 'install_scheduled') return 3;
  if (status === 'installed') return 4;
  if (status === 'complete') return 5;
  return 0;
}

export function AdminDealWorkflow({ deal, onUpdate }: AdminDealWorkflowProps) {
  const queryClient = useQueryClient();
  const [installDate, setInstallDate] = useState(deal.install_date || '');
  const [inspectionDate, setInspectionDate] = useState(deal.inspection_date || '');
  const [adjusterMeetingDate, setAdjusterMeetingDate] = useState(deal.adjuster_meeting_date || '');

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
    if (status === 'materials_ordered') updates.materials_ordered_date = new Date().toISOString().split('T')[0];
    if (status === 'materials_delivered') updates.materials_delivered_date = new Date().toISOString().split('T')[0];
    if (status === 'installed') updates.completion_date = new Date().toISOString().split('T')[0];
    updateMutation.mutate(updates);
  };

  // Determine next action
  const getNextAction = () => {
    switch (deal.status) {
      case 'signed':
      case 'adjuster_scheduled':
        return { label: 'Order Materials', icon: Package, status: 'materials_ordered' as DealStatus };
      case 'materials_ordered':
        return { label: 'Mark Delivered', icon: Truck, status: 'materials_delivered' as DealStatus };
      case 'materials_delivered':
      case 'install_scheduled':
        return { label: 'Mark Installed', icon: CheckCircle2, status: 'installed' as DealStatus };
      case 'installed':
        return { label: 'Mark Complete', icon: DollarSign, status: 'complete' as DealStatus };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();
  const isComplete = currentStepIndex >= 5;

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

      {/* Next Action */}
      {nextAction && (
        <div className="space-y-2">
          {['materials_ordered', 'materials_delivered', 'install_scheduled'].includes(deal.status) && (
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
            onClick={() => handleAction('materials_ordered')}
            disabled={updateMutation.isPending || currentStepIndex >= 2}
            className="gap-1 text-xs"
          >
            <Package className="w-3 h-3" />
            Order
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('materials_delivered')}
            disabled={updateMutation.isPending || currentStepIndex < 2 || currentStepIndex >= 3}
            className="gap-1 text-xs"
          >
            <Truck className="w-3 h-3" />
            Delivered
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('installed')}
            disabled={updateMutation.isPending || currentStepIndex < 3 || currentStepIndex >= 4}
            className="gap-1 text-xs"
          >
            <CheckCircle2 className="w-3 h-3" />
            Installed
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('complete')}
            disabled={updateMutation.isPending || currentStepIndex !== 4}
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
          {/* Inspection */}
          <div className="space-y-2">
            <Label className="text-xs">Inspection Date</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
                className="h-9 flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateMutation.mutate({ status: 'inspection_scheduled', inspection_date: inspectionDate })}
                disabled={updateMutation.isPending || !inspectionDate}
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
                onClick={() => updateMutation.mutate({ status: 'adjuster_scheduled', adjuster_meeting_date: adjusterMeetingDate })}
                disabled={updateMutation.isPending || !adjusterMeetingDate}
              >
                Schedule
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Deal Info - Complete */}
      <div className="space-y-3 pt-2">
        {/* Contact */}
        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
          <User className="w-4 h-4 mt-0.5 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">{deal.homeowner_name}</p>
            <p className="text-xs text-muted-foreground truncate">{deal.address}</p>
            {deal.city && <p className="text-xs text-muted-foreground">{deal.city}, {deal.state} {deal.zip_code}</p>}
            {deal.homeowner_phone && (
              <a href={`tel:${deal.homeowner_phone}`} className="text-xs text-primary flex items-center gap-1 mt-1">
                <Phone className="w-3 h-3" />
                {deal.homeowner_phone}
              </a>
            )}
            {deal.homeowner_email && (
              <p className="text-xs text-muted-foreground mt-0.5">{deal.homeowner_email}</p>
            )}
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

        {/* Financials - Complete */}
        <div className="flex items-start gap-3 p-3 bg-green-500/10 rounded-lg">
          <DollarSign className="w-4 h-4 mt-0.5 text-green-600" />
          <div className="flex-1 space-y-1">
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
        </div>

        {/* Property Details */}
        {(deal.roof_type || deal.roof_squares || deal.stories) && (
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Property Details</p>
              {deal.roof_type && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Roof Type</span>
                  <span>{deal.roof_type}</span>
                </div>
              )}
              {deal.roof_squares && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Squares</span>
                  <span>{deal.roof_squares}</span>
                </div>
              )}
              {deal.stories && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Stories</span>
                  <span>{deal.stories}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contract Status */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">Contract</span>
          </div>
          {deal.contract_signed ? (
            <Badge className="bg-green-500 text-xs">Signed</Badge>
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

        {/* Timeline Dates */}
        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
          <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground" />
          <div className="flex-1 text-xs space-y-1">
            <p className="text-sm font-medium mb-1">Timeline</p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(deal.created_at).toLocaleDateString()}</span>
            </div>
            {deal.signed_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Signed</span>
                <span>{new Date(deal.signed_date).toLocaleDateString()}</span>
              </div>
            )}
            {deal.materials_ordered_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Materials Ordered</span>
                <span>{new Date(deal.materials_ordered_date).toLocaleDateString()}</span>
              </div>
            )}
            {deal.materials_delivered_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivered</span>
                <span>{new Date(deal.materials_delivered_date).toLocaleDateString()}</span>
              </div>
            )}
            {deal.install_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Install Date</span>
                <span className="font-medium">{new Date(deal.install_date).toLocaleDateString()}</span>
              </div>
            )}
            {deal.completion_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span className="text-green-600">{new Date(deal.completion_date).toLocaleDateString()}</span>
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

        {/* Notes */}
        {deal.notes && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Notes</p>
            <p className="text-sm">{deal.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
