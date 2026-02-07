import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Deal, DealStatus, dealsApi } from '@/integrations/aws/api';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { SignaturePad } from './SignaturePad';
import { toast } from 'sonner';
import {
  Check,
  AlertCircle,
  Loader2,
  Calendar,
  Building2,
  FileText,
  User,
  ClipboardCheck,
  FileSignature,
  ChevronRight,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RepDealWorkflowProps {
  deal: Deal;
  onUpdate: () => void;
}

// Step configuration for rep workflow - Based on owner's requirements:
// 1. Knock → 2. Inspect → 3. File Claim → 4. Sign → 5. Meet Adjuster →
// 6. Await Approval → 7. Approved → 8. Collect ACV → 9. Collect Deductible →
// 10. Select Materials → 11. Schedule Install → 12. Installed →
// 13. Completion Form → 14. Invoice → 15. Collect Depreciation → 16. Complete → 17. Paid
const workflowSteps: {
  status: DealStatus;
  label: string;
  description: string;
  icon: React.ElementType;
  requiredFields: { field: keyof Deal; label: string; type: 'text' | 'date' | 'phone' | 'email' | 'number' | 'signature' }[];
  adminOnly?: boolean;
}[] = [
  {
    status: 'lead',
    label: 'Schedule & Complete Inspection',
    description: 'Take inspection photos and show homeowner the report',
    icon: Calendar,
    requiredFields: [],
  },
  {
    status: 'inspection_scheduled',
    label: 'File Claim & Sign Agreement',
    description: 'Call insurance, get adjuster info, sign agreement with homeowner',
    icon: FileSignature,
    requiredFields: [
      { field: 'insurance_company', label: 'Insurance Company', type: 'text' },
      { field: 'policy_number', label: 'Policy Number', type: 'text' },
      { field: 'claim_number', label: 'Claim Number', type: 'text' },
      { field: 'adjuster_name', label: 'Adjuster Name', type: 'text' },
      { field: 'adjuster_meeting_date', label: 'Adjuster Appointment Date', type: 'date' },
    ],
  },
  {
    status: 'claim_filed',
    label: 'Meet Adjuster',
    description: 'Meet adjuster at appointment to inspect the roof',
    icon: ClipboardCheck,
    requiredFields: [],
  },
  {
    status: 'signed',
    label: 'Awaiting Insurance Decision',
    description: 'Waiting for insurance approval/denial/partial approval',
    icon: ClipboardCheck,
    requiredFields: [],
  },
  {
    status: 'adjuster_met',
    label: 'Awaiting Admin Approval',
    description: 'Upload loss statement. Wait for admin to approve financials.',
    icon: Lock,
    requiredFields: [],
    adminOnly: true,
  },
  {
    status: 'awaiting_approval',
    label: 'Approved',
    description: 'Insurance approved! Admin reviewed financials.',
    icon: Check,
    requiredFields: [],
    adminOnly: true,
  },
  {
    status: 'approved',
    label: 'Collect ACV Payment',
    description: 'Collect ACV check from homeowner and give them a receipt',
    icon: Building2,
    requiredFields: [],
  },
  {
    status: 'acv_collected',
    label: 'Collect Deductible',
    description: 'Collect deductible from homeowner and give them a receipt',
    icon: Building2,
    requiredFields: [],
  },
  {
    status: 'deductible_collected',
    label: 'Select Materials',
    description: 'Pick roof materials and colors with homeowner',
    icon: ClipboardCheck,
    requiredFields: [],
  },
  {
    status: 'materials_selected',
    label: 'Ready for Install',
    description: 'All info collected - waiting for admin to schedule install',
    icon: Lock,
    requiredFields: [],
    adminOnly: true,
  },
  {
    status: 'install_scheduled',
    label: 'Installation In Progress',
    description: 'Crew is installing. They will upload progress & completion photos.',
    icon: Lock,
    requiredFields: [],
    adminOnly: true,
  },
  {
    status: 'installed',
    label: 'Get Completion Signature',
    description: 'Have homeowner sign the installation completion form',
    icon: FileSignature,
    requiredFields: [],
  },
  {
    status: 'completion_signed',
    label: 'Invoice Sent',
    description: 'Final invoice sent to insurance for depreciation',
    icon: Lock,
    requiredFields: [],
    adminOnly: true,
  },
  {
    status: 'invoice_sent',
    label: 'Collect Depreciation',
    description: 'Collect depreciation payment, give receipt + roof certificate',
    icon: Building2,
    requiredFields: [],
  },
  {
    status: 'depreciation_collected',
    label: 'Request Commission',
    description: 'All payments collected! Request your commission.',
    icon: Check,
    requiredFields: [],
  },
  {
    status: 'complete',
    label: 'Waiting for Commission',
    description: 'Waiting for admin to approve commission payment',
    icon: Lock,
    requiredFields: [],
    adminOnly: true,
  },
  {
    status: 'paid',
    label: 'Paid!',
    description: 'Commission has been paid! 💰',
    icon: Check,
    requiredFields: [],
    adminOnly: true,
  },
];

// Get the current step index based on status
function getStepIndex(status: DealStatus): number {
  const index = workflowSteps.findIndex(s => s.status === status);
  return index >= 0 ? index : 0;
}

// Check if a step's requirements are met
function isStepComplete(deal: Deal, step: typeof workflowSteps[0]): boolean {
  if (step.requiredFields.length === 0) return true;

  return step.requiredFields.every(req => {
    const value = deal[req.field];
    if (req.type === 'signature') {
      return deal.contract_signed === true;
    }
    if (value === null || value === undefined || value === '') return false;
    return true;
  });
}

export function RepDealWorkflow({ deal, onUpdate }: RepDealWorkflowProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string | number | null>>({});

  const currentStepIndex = getStepIndex(deal.status);
  const currentStep = workflowSteps[currentStepIndex];
  const progress = Math.round(((currentStepIndex + 1) / workflowSteps.length) * 100);

  // Determine what the next status should be based on current status
  const getNextStatus = (): DealStatus | null => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= workflowSteps.length) return null;
    return workflowSteps[nextIndex].status;
  };

  // Save fields and auto-progress if all requirements are met
  const handleSaveAndProgress = async () => {
    if (!deal) return;
    setSaving(true);

    try {
      const updates: Partial<Deal> = { ...formData };

      // Handle signature upload
      if (signatureDataUrl) {
        const base64Data = signatureDataUrl.split(',')[1];
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

        updates.signature_url = publicUrlData.publicUrl;
        updates.signature_date = new Date().toISOString();
        updates.contract_signed = true;
        updates.signed_date = new Date().toISOString().split('T')[0];
      }

      // Check if all requirements for current step will be met after this save
      const simulatedDeal = { ...deal, ...updates };
      const allRequirementsMet = currentStep.requiredFields.every(req => {
        const value = simulatedDeal[req.field];
        if (req.type === 'signature') {
          return simulatedDeal.contract_signed === true;
        }
        return value !== null && value !== undefined && value !== '';
      });

      // If all requirements met, auto-progress to next status
      if (allRequirementsMet) {
        const nextStatus = getNextStatus();
        if (nextStatus && !workflowSteps[currentStepIndex + 1]?.adminOnly) {
          updates.status = nextStatus;
        } else if (nextStatus && workflowSteps[currentStepIndex + 1]?.adminOnly) {
          // Move to signed if next step is admin-only
          updates.status = 'signed';
        }
      }

      // Update via API
      const response = await dealsApi.update(deal.id, updates);
      if (response.error) throw new Error(response.error);

      queryClient.invalidateQueries({ queryKey: ['deals'] });

      if (updates.status && updates.status !== deal.status) {
        toast.success(`Deal moved to: ${statusConfig[updates.status]?.label || updates.status}`);
      } else {
        toast.success('Deal updated successfully');
      }

      setFormData({});
      setSignatureDataUrl(null);
      onUpdate();
    } catch (error) {
      toast.error('Failed to update: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  // Status config for labels
  const statusConfig: Record<string, { label: string }> = {
    lead: { label: 'Lead' },
    inspection_scheduled: { label: 'Inspection Scheduled' },
    claim_filed: { label: 'Claim Filed' },
    adjuster_met: { label: 'Awaiting Approval' },
    approved: { label: 'Approved' },
    signed: { label: 'Signed' },
    collect_acv: { label: 'Collect ACV' },
    collect_deductible: { label: 'Collect Deductible' },
    install_scheduled: { label: 'Install Scheduled' },
    installed: { label: 'Installed' },
  };

  // Check if we're at an admin-only step
  const isAdminStep = currentStep?.adminOnly;

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Deal Progress</h3>
          <Badge variant="outline">{progress}% Complete</Badge>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Timeline - Show rep steps (first 4) */}
      <div className="space-y-1">
        {workflowSteps.slice(0, 4).map((step, index) => {
          const isComplete = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isPending = index > currentStepIndex;
          const StepIcon = step.icon;

          return (
            <div
              key={step.status}
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg transition-colors",
                isCurrent && "bg-primary/10 border border-primary/30",
                isComplete && "opacity-60"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                isComplete && "bg-green-500 text-white",
                isCurrent && "bg-primary text-white",
                isPending && "bg-muted text-muted-foreground"
              )}>
                {isComplete ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium",
                  isCurrent && "text-primary",
                  isPending && "text-muted-foreground"
                )}>
                  {index + 1}. {step.label}
                </p>
                {isCurrent && (
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                )}
              </div>
              {isCurrent && <ChevronRight className="w-4 h-4 text-primary" />}
            </div>
          );
        })}

        {/* Show Install & Complete steps */}
        <div className={cn(
          "flex items-center gap-3 p-2 rounded-lg transition-colors",
          currentStepIndex >= 4 && currentStepIndex < 9 && "bg-primary/10 border border-primary/30",
          currentStepIndex < 4 && "opacity-40"
        )}>
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            currentStepIndex >= 9 && "bg-green-500 text-white",
            currentStepIndex >= 4 && currentStepIndex < 9 && "bg-primary text-white",
            currentStepIndex < 4 && "bg-muted text-muted-foreground"
          )}>
            {currentStepIndex >= 9 ? <Check className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-sm font-medium",
              currentStepIndex >= 4 && currentStepIndex < 9 && "text-primary",
              currentStepIndex < 4 && "text-muted-foreground"
            )}>
              5. Install (Admin)
            </p>
            {currentStepIndex >= 4 && currentStepIndex < 9 && (
              <p className="text-xs text-muted-foreground">Admin handles materials & installation</p>
            )}
          </div>
        </div>

        <div className={cn(
          "flex items-center gap-3 p-2 rounded-lg transition-colors",
          currentStepIndex === 9 && "bg-primary/10 border border-primary/30",
          currentStepIndex < 9 && "opacity-40"
        )}>
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            currentStepIndex >= 10 && "bg-green-500 text-white",
            currentStepIndex === 9 && "bg-primary text-white",
            currentStepIndex < 9 && "bg-muted text-muted-foreground"
          )}>
            {currentStepIndex >= 10 ? <Check className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-sm font-medium",
              currentStepIndex === 9 && "text-primary",
              currentStepIndex < 9 && "text-muted-foreground"
            )}>
              6. Collect RCV Final Payment
            </p>
          </div>
        </div>

        <div className={cn(
          "flex items-center gap-3 p-2 rounded-lg transition-colors",
          currentStepIndex >= 10 && "bg-green-500/10 border border-green-500/30",
          currentStepIndex < 10 && "opacity-40"
        )}>
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            currentStepIndex >= 10 && "bg-green-500 text-white",
            currentStepIndex < 10 && "bg-muted text-muted-foreground"
          )}>
            <Check className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-sm font-medium",
              currentStepIndex >= 10 && "text-green-600",
              currentStepIndex < 10 && "text-muted-foreground"
            )}>
              7. Completed
            </p>
          </div>
        </div>
      </div>

      {/* Admin Steps Indicator */}
      {currentStepIndex >= 4 && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-medium text-amber-700">Admin Phase</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Materials ordering and installation are handled by admin.
          </p>
        </div>
      )}

      {/* Current Step Actions */}
      {!isAdminStep && currentStep && currentStep.requiredFields.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-primary" />
              Complete This Step
            </CardTitle>
            <CardDescription>
              Fill in the required fields below to move to the next step
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentStep.requiredFields.map((req) => {
              const currentValue = formData[req.field] ?? deal[req.field] ?? '';
              const isFieldComplete = currentValue !== '' && currentValue !== null;

              if (req.type === 'signature') {
                return (
                  <div key={req.field} className="space-y-2">
                    <Label className="flex items-center gap-2">
                      {req.label}
                      {deal.contract_signed && <Check className="w-4 h-4 text-green-500" />}
                    </Label>
                    {deal.contract_signed ? (
                      <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-sm text-green-700">Contract already signed</p>
                        {deal.signature_url && (
                          <img src={deal.signature_url} alt="Signature" className="mt-2 max-h-16 border rounded" />
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <SignaturePad onSignatureChange={setSignatureDataUrl} />
                        {signatureDataUrl && (
                          <Badge variant="outline" className="gap-1">
                            <Check className="w-3 h-3" /> Signature captured
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={req.field} className="space-y-2">
                  <Label className="flex items-center gap-2">
                    {req.label}
                    {isFieldComplete && <Check className="w-4 h-4 text-green-500" />}
                  </Label>
                  <Input
                    type={req.type === 'number' ? 'number' : req.type === 'date' ? 'date' : 'text'}
                    value={String(formData[req.field] ?? deal[req.field] ?? '')}
                    onChange={(e) => {
                      const value = req.type === 'number' ? parseFloat(e.target.value) || null : e.target.value;
                      setFormData({ ...formData, [req.field]: value });
                    }}
                    placeholder={`Enter ${req.label.toLowerCase()}`}
                  />
                </div>
              );
            })}

            <Button
              onClick={handleSaveAndProgress}
              disabled={saving}
              className="w-full gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Save & Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Waiting for Admin */}
      {isAdminStep && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <Lock className="w-8 h-8 mx-auto text-amber-600" />
              <h3 className="font-semibold">Waiting for Admin</h3>
              <p className="text-sm text-muted-foreground">
                Your deal is signed and complete! Admin will handle materials and installation.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Deal Info Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Deal Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Homeowner</span>
            <span className="font-medium">{deal.homeowner_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Address</span>
            <span className="font-medium truncate max-w-[200px]">{deal.address}</span>
          </div>
          {deal.insurance_company && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Insurance</span>
              <span className="font-medium">{deal.insurance_company}</span>
            </div>
          )}
          {deal.claim_number && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Claim #</span>
              <span className="font-medium">{deal.claim_number}</span>
            </div>
          )}
          {deal.rcv && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">RCV</span>
              <span className="font-medium">${deal.rcv.toLocaleString()}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
