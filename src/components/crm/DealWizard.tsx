import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AwsAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SignaturePad } from './SignaturePad';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Check, User, Home, DollarSign, Users, FileSignature } from 'lucide-react';
import { z } from 'zod';

interface DealWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
}

const steps = [
  { id: 1, title: 'Homeowner', icon: User },
  { id: 2, title: 'Property', icon: Home },
  { id: 3, title: 'Deal Details', icon: DollarSign },
  { id: 4, title: 'Team', icon: Users },
  { id: 5, title: 'Contract', icon: FileSignature },
];

const homeownerSchema = z.object({
  homeowner_name: z.string().min(2, 'Name is required'),
  homeowner_phone: z.string().optional(),
  homeowner_email: z.string().email('Invalid email').optional().or(z.literal('')),
});

const propertySchema = z.object({
  address: z.string().min(5, 'Address is required'),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
});

export function DealWizard({ open, onOpenChange, isAdmin = false }: DealWizardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    // Step 1: Homeowner
    homeowner_name: '',
    homeowner_phone: '',
    homeowner_email: '',
    // Step 2: Property
    address: '',
    city: '',
    state: '',
    zip_code: '',
    // Step 3: Deal Details
    total_price: '',
    status: 'lead' as const,
    notes: '',
    // Step 4: Team
    commission_type: 'self_gen' as 'self_gen' | 'setter' | 'closer',
    setter_rep_id: '',
    closer_rep_id: '',
  });

  // Get current rep id
  const { data: repId } = useQuery({
    queryKey: ['current-rep'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_rep_id');
      if (error) throw error;
      return data as string;
    },
    enabled: !isAdmin,
  });

  // Get all reps for admin or for setter/closer assignment
  const { data: allReps } = useQuery({
    queryKey: ['all-reps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reps')
        .select(`
          id,
          user_id,
          profiles:user_id (full_name, email)
        `);
      if (error) throw error;
      return data;
    },
  });

  const createDealMutation = useMutation({
    mutationFn: async () => {
      // Create the deal
      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .insert({
          homeowner_name: formData.homeowner_name,
          homeowner_phone: formData.homeowner_phone || null,
          homeowner_email: formData.homeowner_email || null,
          address: formData.address,
          city: formData.city || null,
          state: formData.state || null,
          zip_code: formData.zip_code || null,
          total_price: parseFloat(formData.total_price) || 0,
          status: formData.status,
          notes: formData.notes || null,
          contract_signed: !!signatureDataUrl,
          signature_date: signatureDataUrl ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (dealError) throw dealError;

      // Upload signature if exists
      if (signatureDataUrl && deal) {
        const base64Data = signatureDataUrl.split(',')[1];
        const blob = await fetch(signatureDataUrl).then(r => r.blob());
        const fileName = `${deal.id}/signature.png`;

        const { error: uploadError } = await supabase.storage
          .from('deal-signatures')
          .upload(fileName, blob);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('deal-signatures')
            .getPublicUrl(fileName);

          await supabase
            .from('deals')
            .update({ signature_url: publicUrl })
            .eq('id', deal.id);
        }
      }

      // Create commission records based on type
      const commissionInserts = [];
      const currentRepId = isAdmin ? formData.setter_rep_id || formData.closer_rep_id : repId;

      if (formData.commission_type === 'self_gen' && currentRepId) {
        commissionInserts.push({
          deal_id: deal.id,
          rep_id: currentRepId,
          commission_type: 'self_gen' as const,
          commission_percent: 0,
          commission_amount: 0,
        });
      } else if (formData.commission_type === 'setter' || formData.commission_type === 'closer') {
        // Add setter
        if (formData.setter_rep_id) {
          commissionInserts.push({
            deal_id: deal.id,
            rep_id: formData.setter_rep_id,
            commission_type: 'setter' as const,
            commission_percent: 0,
            commission_amount: 0,
          });
        }
        // Add closer
        if (formData.closer_rep_id) {
          commissionInserts.push({
            deal_id: deal.id,
            rep_id: formData.closer_rep_id,
            commission_type: 'closer' as const,
            commission_percent: 0,
            commission_amount: 0,
          });
        }
      }

      if (commissionInserts.length > 0) {
        const { error: commError } = await supabase
          .from('deal_commissions')
          .insert(commissionInserts);
        if (commError) throw commError;
      }

      return deal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Deal created successfully!');
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Failed to create deal: ' + error.message);
    },
  });

  const resetForm = () => {
    setCurrentStep(1);
    setSignatureDataUrl(null);
    setFormData({
      homeowner_name: '',
      homeowner_phone: '',
      homeowner_email: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      total_price: '',
      status: 'lead',
      notes: '',
      commission_type: 'self_gen',
      setter_rep_id: '',
      closer_rep_id: '',
    });
  };

  const validateStep = (step: number): boolean => {
    try {
      if (step === 1) {
        homeownerSchema.parse(formData);
      } else if (step === 2) {
        propertySchema.parse(formData);
      }
      return true;
    } catch (e) {
      if (e instanceof z.ZodError) {
        toast.error(e.errors[0].message);
      }
      return false;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = () => {
    createDealMutation.mutate();
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Deal</DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-8 h-0.5 mx-1 ${
                      isCompleted ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="text-center mb-4">
          <h3 className="font-semibold">{steps[currentStep - 1].title}</h3>
        </div>

        {/* Step Content */}
        <div className="space-y-4">
          {currentStep === 1 && (
            <>
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  value={formData.homeowner_name}
                  onChange={(e) => updateField('homeowner_name', e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  type="tel"
                  value={formData.homeowner_phone}
                  onChange={(e) => updateField('homeowner_phone', e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.homeowner_email}
                  onChange={(e) => updateField('homeowner_email', e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
            </>
          )}

          {currentStep === 2 && (
            <>
              <div className="space-y-2">
                <Label>Street Address *</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="123 Main St"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    value={formData.state}
                    onChange={(e) => updateField('state', e.target.value)}
                    placeholder="TX"
                    maxLength={2}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>ZIP Code</Label>
                <Input
                  value={formData.zip_code}
                  onChange={(e) => updateField('zip_code', e.target.value)}
                  placeholder="12345"
                  maxLength={10}
                />
              </div>
            </>
          )}

          {currentStep === 3 && (
            <>
              <div className="space-y-2">
                <Label>Total Price ($)</Label>
                <Input
                  type="number"
                  value={formData.total_price}
                  onChange={(e) => updateField('total_price', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => updateField('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="signed">Signed</SelectItem>
                    <SelectItem value="permit">Permit</SelectItem>
                    <SelectItem value="install_scheduled">Install Scheduled</SelectItem>
                    <SelectItem value="installed">Installed</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>
            </>
          )}

          {currentStep === 4 && (
            <>
              <div className="space-y-2">
                <Label>Commission Type</Label>
                <Select
                  value={formData.commission_type}
                  onValueChange={(value) => updateField('commission_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self_gen">Self-Generated (100%)</SelectItem>
                    <SelectItem value="setter">Setter/Closer Split</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(formData.commission_type === 'setter' || isAdmin) && (
                <>
                  <div className="space-y-2">
                    <Label>Setter</Label>
                    <Select
                      value={formData.setter_rep_id}
                      onValueChange={(value) => updateField('setter_rep_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select setter..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allReps?.map((rep) => (
                          <SelectItem key={rep.id} value={rep.id}>
                            {(rep.profiles as any)?.full_name || (rep.profiles as any)?.email || 'Unknown'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Closer</Label>
                    <Select
                      value={formData.closer_rep_id}
                      onValueChange={(value) => updateField('closer_rep_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select closer..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allReps?.map((rep) => (
                          <SelectItem key={rep.id} value={rep.id}>
                            {(rep.profiles as any)?.full_name || (rep.profiles as any)?.email || 'Unknown'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {formData.commission_type === 'self_gen' && !isAdmin && (
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  This deal will be assigned to you with 100% commission.
                </p>
              )}
            </>
          )}

          {currentStep === 5 && (
            <>
              <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
                <p className="font-medium">Roofing Work Authorization</p>
                <p className="text-muted-foreground">
                  I, <span className="font-medium text-foreground">{formData.homeowner_name}</span>, 
                  hereby authorize RoofCommission Pro to perform roofing work at the property located at:
                </p>
                <p className="font-medium">
                  {formData.address}{formData.city ? `, ${formData.city}` : ''}{formData.state ? `, ${formData.state}` : ''} {formData.zip_code}
                </p>
                <p className="text-muted-foreground mt-2">
                  I understand and agree to the terms and conditions of this roofing project.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Homeowner Signature *</Label>
                <SignaturePad onSignatureChange={setSignatureDataUrl} />
              </div>

              {!signatureDataUrl && (
                <p className="text-sm text-amber-600">
                  Please sign above to authorize the work.
                </p>
              )}
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          {currentStep < 5 ? (
            <Button onClick={nextStep}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!signatureDataUrl || createDealMutation.isPending}
            >
              {createDealMutation.isPending ? 'Creating...' : 'Create Deal'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
