import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dealsApi } from '@/integrations/aws/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SignaturePad } from '@/components/crm/SignaturePad';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Check, User, Home, DollarSign, Users, FileSignature } from 'lucide-react';
import { z } from 'zod';

const MAPBOX_TOKEN_ENV = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

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

export default function NewDeal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    homeowner_name: '',
    homeowner_phone: '',
    homeowner_email: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    total_price: '',
    status: 'lead' as const,
    notes: '',
  });

  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [propertyOwners, setPropertyOwners] = useState<string[]>([]);
  const [isSearchingOwners, setIsSearchingOwners] = useState(false);

  const createDealMutation = useMutation({
    mutationFn: async () => {
      const response = await dealsApi.create({
        homeowner_name: formData.homeowner_name,
        homeowner_phone: formData.homeowner_phone || undefined,
        homeowner_email: formData.homeowner_email || undefined,
        address: formData.address,
        city: formData.city || undefined,
        state: formData.state || undefined,
        zip_code: formData.zip_code || undefined,
        total_price: parseFloat(formData.total_price) || 0,
        status: formData.status,
        notes: formData.notes || undefined,
        contract_signed: !!signatureDataUrl,
        signature_url: signatureDataUrl || undefined,
      });
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Deal created successfully!');
      navigate('/deals');
    },
    onError: (error) => {
      toast.error('Failed to create deal: ' + error.message);
    },
  });

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

  const handleAddressChange = (value: string) => {
    setFormData(prev => ({ ...prev, address: value }));
    if (value.length > 2) {
      searchAddresses(value);
    } else {
      setAddressSuggestions([]);
    }
  };

  const handleAddressSelect = (address: string) => {
    setFormData(prev => ({ ...prev, address }));
    setAddressSuggestions([]);
  };

  const searchAddresses = async (query: string) => {
    if (!MAPBOX_TOKEN_ENV || query.length < 3) {
      setAddressSuggestions([]);
      return;
    }

    setIsSearchingAddress(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN_ENV}&limit=5&types=address`,
      );
      const data = await response.json();
      const suggestions = data.features?.map((feature: { place_name: string }) => feature.place_name) || [];
      setAddressSuggestions(suggestions);
    } catch (error) {
      console.error("Error searching addresses:", error);
      setAddressSuggestions([]);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <div 
        className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <button
          onClick={() => navigate('/deals')}
          className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">New Deal</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-lg mx-auto">
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

                {/* Property Owners Search Results */}
                {(isSearchingOwners || propertyOwners.length > 0) && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">On Title</Label>
                    <div className="relative">
                      {isSearchingOwners && (
                        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <span className="text-sm text-muted-foreground">Searching property records...</span>
                        </div>
                      )}
                      {propertyOwners.length > 0 && (
                        <div className="bg-muted/50 border border-border rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-2">Click a name to auto-fill homeowner field:</p>
                          <div className="flex flex-wrap gap-2">
                            {propertyOwners.map((owner, index) => (
                              <button
                                key={index}
                                onClick={() => handleOwnerSelect(owner)}
                                className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-sm rounded-full transition-colors border border-primary/20 hover:border-primary/40"
                              >
                                {owner}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

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
                  <div className="relative">
                    <Input
                      value={formData.address}
                      onChange={(e) => handleAddressChange(e.target.value)}
                      placeholder="123 Main St"
                      className="pr-8"
                    />
                    {isSearchingAddress && (
                      <div className="absolute right-3 top-8 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    )}
                    {addressSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-auto mt-1">
                        {addressSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => handleAddressSelect(suggestion)}
                            className="w-full px-3 py-2 text-left hover:bg-muted transition-colors text-sm"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Start typing to see address suggestions
                  </p>
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
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                This deal will be assigned to you. Commissions can be configured after the deal is created.
              </p>
            )}

            {currentStep === 5 && (
              <>
                <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
                  <p className="font-medium">Roofing Work Authorization</p>
                  <p className="text-muted-foreground">
                    I, <span className="font-medium text-foreground">{formData.homeowner_name}</span>, 
                    hereby authorize Titan Prime Solutions to perform roofing work at the property located at:
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
                  <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                    A signature is recommended but not required to create a deal as a lead.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pb-8">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>

            {currentStep < 5 ? (
              <Button onClick={nextStep} className="gap-1">
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={createDealMutation.isPending}
              >
                {createDealMutation.isPending ? 'Creating...' : 'Create Deal'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
