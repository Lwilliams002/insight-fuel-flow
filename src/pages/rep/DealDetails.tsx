import { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dealsApi, Deal, repsApi } from '@/integrations/aws/api';
import { useAwsAuth } from '@/contexts/AwsAuthContext';
import { RepLayout } from '@/components/RepLayout';
import { DealPipeline, InsuranceCard } from '@/components/DealCRMComponents';
import { MilestoneProgressTracker } from '@/components/crm/MilestoneProgressTracker';
import { DealStatus, dealStatusConfig, adjusterMeetingChecklist, calculateDealStatus, getProgressionRequirements } from '@/lib/crmProcess';
import { InvoiceGenerator, InspectionReportGenerator } from '@/components/receipts';
import { DocumentUpload, ImageUpload } from '@/components/uploads';
import { SecureDocumentLink } from '@/components/ui/SecureImage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Home,
  FileText,
  Camera,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Save,
  X,
  FileSignature,
  Shield,
  Receipt,
  Upload,
  ExternalLink
} from 'lucide-react';

// Signature pad component
function SignaturePad({ onSave, onClear }: { onSave: (dataUrl: string) => void; onClear: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const getCoords = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#0F1E2E';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      onClear();
    }
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={300}
        height={150}
        className="border rounded-lg bg-white w-full touch-none"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <Button type="button" variant="outline" size="sm" onClick={clearSignature}>
        Clear Signature
      </Button>
    </div>
  );
}

// Material Specifications Form Component
function MaterialSpecificationsForm({
  deal,
  onSave
}: {
  deal: Deal;
  onSave: (data: Partial<Deal>) => void;
}) {
  const [materialCategory, setMaterialCategory] = useState(deal.material_category || '');
  const [materialType, setMaterialType] = useState(deal.material_type || '');
  const [materialColor, setMaterialColor] = useState(deal.material_color || '');
  const [dripEdge, setDripEdge] = useState(deal.drip_edge || '');
  const [ventColor, setVentColor] = useState(deal.vent_color || '');
  const [hasChanges, setHasChanges] = useState(false);

  // Check if there are unsaved changes
  const checkChanges = () => {
    const changed =
      materialCategory !== (deal.material_category || '') ||
      materialType !== (deal.material_type || '') ||
      materialColor !== (deal.material_color || '') ||
      dripEdge !== (deal.drip_edge || '') ||
      ventColor !== (deal.vent_color || '');
    setHasChanges(changed);
  };

  const handleSave = () => {
    onSave({
      material_category: materialCategory || null,
      material_type: materialType || null,
      material_color: materialColor || null,
      drip_edge: dripEdge || null,
      vent_color: ventColor || null,
    });
    setHasChanges(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Material Category</Label>
          <Select
            value={materialCategory}
            onValueChange={(value) => {
              setMaterialCategory(value);
              checkChanges();
              setHasChanges(true);
            }}
          >
            <SelectTrigger>
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
        {(materialCategory === 'Metal' || materialCategory === 'Architectural Metal') && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Metal Type</Label>
            <Input
              placeholder="Enter metal type"
              value={materialType}
              onChange={(e) => {
                setMaterialType(e.target.value);
                setHasChanges(true);
              }}
            />
          </div>
        )}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Material Color</Label>
          <Input
            placeholder="Enter color"
            value={materialColor}
            onChange={(e) => {
              setMaterialColor(e.target.value);
              setHasChanges(true);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Drip Edge</Label>
          <Input
            placeholder="Enter drip edge"
            value={dripEdge}
            onChange={(e) => {
              setDripEdge(e.target.value);
              setHasChanges(true);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Vent Color</Label>
          <Input
            placeholder="Enter vent color"
            value={ventColor}
            onChange={(e) => {
              setVentColor(e.target.value);
              setHasChanges(true);
            }}
          />
        </div>
      </div>
      {hasChanges && (
        <Button onClick={handleSave} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          Save Material Specifications
        </Button>
      )}
    </div>
  );
}

export default function DealDetails() {
  const navigate = useNavigate();
  const { dealId } = useParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [isEditingInsurance, setIsEditingInsurance] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  // Form data for overview
  const [overviewForm, setOverviewForm] = useState({
    homeowner_name: '',
    homeowner_phone: '',
    homeowner_email: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    roof_type: '',
    roof_squares: '',
    notes: '',
  });

  // Form data for insurance
  const [insuranceForm, setInsuranceForm] = useState({
    insurance_company: '',
    policy_number: '',
    claim_number: '',
    date_of_loss: '',
    deductible: '',
    rcv: '',
    acv: '',
    depreciation: '',
    adjuster_name: '',
    adjuster_phone: '',
    adjuster_meeting_date: '',
  });

  // Agreement form data
  const [agreementForm, setAgreementForm] = useState({
    squareFootage: '',
    tearOff: 'N',
    layers: '',
    slope: '',
    shingleColor: '',
    ridgeCap: '',
    valley: '',
    dripEdge: '',
    numVents: '',
    pipeJacks: '',
  });

  // Get current user
  const { user } = useAwsAuth();

  // Fetch current rep's info for commission level
  const { data: currentRep } = useQuery({
    queryKey: ['currentRep', user?.sub],
    queryFn: async () => {
      if (!user?.sub) return null;
      // Get the rep by listing all and finding by user_id
      const result = await repsApi.list();
      if (result.error) return null;
      const rep = result.data?.find(r => r.user_id === user.sub);
      return rep || null;
    },
    enabled: !!user?.sub,
  });

  // Commission level percentages - matches RepsManagement
  const commissionLevelPercentages: Record<string, number> = {
    'junior': 5,
    'senior': 10,
    'manager': 13,
  };

  // Commission level display names
  const commissionLevelDisplayNames: Record<string, string> = {
    'junior': 'Junior',
    'senior': 'Senior',
    'manager': 'Manager',
  };

  // Get the rep's commission percentage - prioritize the database value
  const repCommissionPercent =
    // First check if rep has a specific default_commission_percent set
    (currentRep?.default_commission_percent && currentRep.default_commission_percent > 0)
      ? currentRep.default_commission_percent
      // Otherwise, look up by commission level
      : commissionLevelPercentages[currentRep?.commission_level || ''] || 0;

  // Get the rep's commission level display name
  const repCommissionLevelName = commissionLevelDisplayNames[currentRep?.commission_level || ''] || currentRep?.commission_level || '';

  // Fetch deal data
  const { data: deal, isLoading, error } = useQuery({
    queryKey: ['deal', dealId],
    queryFn: async () => {
      const result = await dealsApi.get(dealId!);
      if (result.error) throw new Error(result.error);

      // Initialize forms when deal is loaded
      const d = result.data!;
      setOverviewForm({
        homeowner_name: d.homeowner_name || '',
        homeowner_phone: d.homeowner_phone || '',
        homeowner_email: d.homeowner_email || '',
        address: d.address || '',
        city: d.city || '',
        state: d.state || '',
        zip_code: d.zip_code || '',
        roof_type: d.roof_type || '',
        roof_squares: d.roof_squares?.toString() || '',
        notes: d.notes || '',
      });
      setInsuranceForm({
        insurance_company: d.insurance_company || '',
        policy_number: d.policy_number || '',
        claim_number: d.claim_number || '',
        date_of_loss: d.date_of_loss || '',
        deductible: d.deductible?.toString() || '',
        rcv: d.rcv?.toString() || '',
        acv: d.acv?.toString() || '',
        depreciation: d.depreciation?.toString() || '',
        adjuster_name: d.adjuster_name || '',
        adjuster_phone: d.adjuster_phone || '',
        adjuster_meeting_date: d.adjuster_meeting_date?.split('T')[0] || '',
      });
      return d;
    },
    enabled: !!dealId,
  });

  // Update deal mutation with auto-progression
  const updateDealMutation = useMutation({
    mutationFn: async (updates: Partial<Deal>) => {
      // Merge updates with current deal data for status calculation
      const mergedDeal = { ...deal, ...updates };

      // Auto-calculate the status based on the deal's data
      const calculatedStatus = calculateDealStatus(mergedDeal);

      // Only update status if it would progress forward (not go backwards)
      const currentStepNumber = dealStatusConfig[deal?.status as DealStatus]?.stepNumber || 0;
      const newStepNumber = dealStatusConfig[calculatedStatus]?.stepNumber || 0;

      if (newStepNumber > currentStepNumber) {
        updates.status = calculatedStatus;

        // Set timestamp for the new milestone
        const timestampField = `${calculatedStatus.replace(/-/g, '_')}_date` as keyof Deal;
        if (!mergedDeal[timestampField]) {
          (updates as Record<string, unknown>)[timestampField] = new Date().toISOString();
        }
      }

      const result = await dealsApi.update(dealId!, updates);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Deal updated successfully');
      setIsEditingOverview(false);
      setIsEditingInsurance(false);
    },
    onError: (error: Error) => {
      toast.error('Failed to update deal', { description: error.message });
    },
  });

  // Handle status change
  const handleStatusChange = (newStatus: DealStatus) => {
    updateDealMutation.mutate({ status: newStatus });
  };

  // Save overview
  const handleSaveOverview = () => {
    updateDealMutation.mutate({
      homeowner_name: overviewForm.homeowner_name,
      homeowner_phone: overviewForm.homeowner_phone || null,
      homeowner_email: overviewForm.homeowner_email || null,
      address: overviewForm.address,
      city: overviewForm.city || null,
      state: overviewForm.state || null,
      zip_code: overviewForm.zip_code || null,
      roof_type: overviewForm.roof_type || null,
      roof_squares: overviewForm.roof_squares ? parseFloat(overviewForm.roof_squares) : null,
      notes: overviewForm.notes || null,
    });
  };

  // Save insurance
  const handleSaveInsurance = () => {
    const updates: Partial<Deal> = {
      insurance_company: insuranceForm.insurance_company || null,
      policy_number: insuranceForm.policy_number || null,
      claim_number: insuranceForm.claim_number || null,
      date_of_loss: insuranceForm.date_of_loss || null,
      deductible: insuranceForm.deductible ? parseFloat(insuranceForm.deductible) : null,
      rcv: insuranceForm.rcv ? parseFloat(insuranceForm.rcv) : null,
      acv: insuranceForm.acv ? parseFloat(insuranceForm.acv) : null,
      depreciation: insuranceForm.depreciation ? parseFloat(insuranceForm.depreciation) : null,
      adjuster_name: insuranceForm.adjuster_name || null,
      adjuster_phone: insuranceForm.adjuster_phone || null,
      adjuster_meeting_date: insuranceForm.adjuster_meeting_date || null,
    };

    // Set claim_filed_date if insurance company and claim number are provided and not already set
    if (insuranceForm.insurance_company && insuranceForm.claim_number && !deal?.claim_filed_date) {
      updates.claim_filed_date = new Date().toISOString();
    }

    updateDealMutation.mutate(updates);
  };

  // Sign agreement
  const handleSignAgreement = () => {
    if (!signatureDataUrl) {
      toast.error('Please provide a signature');
      return;
    }
    updateDealMutation.mutate({
      contract_signed: true,
      signed_date: new Date().toISOString(), // Full ISO timestamp
      agreement_document_url: signatureDataUrl, // Store signature as data URL for now
    });
    setShowAgreement(false);
    toast.success('Agreement signed successfully!');
  };

  // Request payment
  const handleRequestPayment = () => {
    updateDealMutation.mutate({
      payment_requested: true,
      payment_request_date: new Date().toISOString(),
    });
    toast.success('Payment request submitted!');
  };

  if (isLoading) {
    return (
      <RepLayout title="Deal Details">
        <div className="p-4 space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </RepLayout>
    );
  }

  if (error || !deal) {
    return (
      <RepLayout title="Deal Details">
        <div className="p-4 flex flex-col items-center justify-center min-h-[50vh]">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-lg font-semibold">Deal not found</h2>
          <Button onClick={() => navigate('/deals')} className="mt-4">
            Back to Deals
          </Button>
        </div>
      </RepLayout>
    );
  }

  const currentStatus = deal.status as DealStatus;
  const config = dealStatusConfig[currentStatus];
  const currentStep = config?.stepNumber || 0;

  // Build timestamps object for milestone tracker
  const milestoneTimestamps: Record<string, string | null> = {
    lead: deal.lead_date || deal.created_at,
    inspection_scheduled: deal.inspection_scheduled_date || deal.inspection_date,
    claim_filed: deal.claim_filed_date,
    adjuster_met: deal.adjuster_met_date || deal.adjuster_meeting_date,
    approved: deal.approved_date,
    signed: deal.signed_date,
    collect_acv: deal.collect_acv_date || deal.acv_check_date,
    collect_deductible: deal.collect_deductible_date,
    install_scheduled: deal.install_scheduled_date || deal.install_date,
    installed: deal.installed_date || deal.completion_date,
    invoice_sent: deal.invoice_sent_at || deal.invoice_sent_date,
    depreciation_collected: deal.depreciation_collected_date || deal.depreciation_check_date,
    complete: deal.complete_date,
  };

  return (
    <RepLayout title="Deal Details" showBackButton onBack={() => navigate('/deals')}>
      <div className="p-4 pb-24 space-y-4">
        {/* Milestone Progress Tracker - moved to top for better visibility */}
        <MilestoneProgressTracker
          currentStatus={currentStatus}
          timestamps={milestoneTimestamps as Record<DealStatus, string | null>}
        />

        {/* Next Steps Guide */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2">
              <ChevronRight className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <p className="font-semibold text-sm">Next Step</p>
                <p className="text-sm text-muted-foreground">
                  {getProgressionRequirements(currentStatus)[0] || 'Complete current step'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Approval Type Section - Show when awaiting approval */}
        {(currentStatus === 'adjuster_met' || currentStatus === 'claim_filed' ||
          (deal.contract_signed && !deal.approval_type && !deal.approved_date)) && (
          <Card className="border-amber-500 bg-amber-500/10">
            <CardContent className="py-4 space-y-3">
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
            </CardContent>
          </Card>
        )}

        {/* Show Approval Type if already set */}
        {deal.approval_type && deal.approval_type !== 'supplement_needed' && (
          <Card className="border-green-500/30 bg-green-500/10">
            <CardContent className="py-3">
              <div className="flex items-center gap-2">
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
            </CardContent>
          </Card>
        )}

        {/* Show Supplement Needed warning with option to update */}
        {deal.approval_type === 'supplement_needed' && (
          <Card className="border-amber-500 bg-amber-500/10">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-600">Supplement Needed</h3>
                  <p className="text-xs text-muted-foreground">
                    Cannot progress until supplement is approved. Update when ready.
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
            </CardContent>
          </Card>
        )}

        {/* Tabs for different sections - removed Timeline tab */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="insurance">Insurance</TabsTrigger>
            <TabsTrigger value="docs">Docs</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Homeowner Info */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Homeowner
                  </CardTitle>
                  {!isEditingOverview ? (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingOverview(true)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setIsEditingOverview(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={handleSaveOverview} disabled={updateDealMutation.isPending}>
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {isEditingOverview ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={overviewForm.homeowner_name}
                        onChange={(e) => setOverviewForm({ ...overviewForm, homeowner_name: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Phone</Label>
                        <Input
                          type="tel"
                          value={overviewForm.homeowner_phone}
                          onChange={(e) => setOverviewForm({ ...overviewForm, homeowner_phone: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={overviewForm.homeowner_email}
                          onChange={(e) => setOverviewForm({ ...overviewForm, homeowner_email: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Name</p>
                      <p className="font-medium">{deal.homeowner_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-medium">{deal.homeowner_phone || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium">{deal.homeowner_email || '-'}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Property Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Property
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isEditingOverview ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Address</Label>
                      <Input
                        value={overviewForm.address}
                        onChange={(e) => setOverviewForm({ ...overviewForm, address: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>City</Label>
                        <Input
                          value={overviewForm.city}
                          onChange={(e) => setOverviewForm({ ...overviewForm, city: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>State</Label>
                        <Input
                          value={overviewForm.state}
                          onChange={(e) => setOverviewForm({ ...overviewForm, state: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>ZIP</Label>
                        <Input
                          value={overviewForm.zip_code}
                          onChange={(e) => setOverviewForm({ ...overviewForm, zip_code: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Roof Type</Label>
                        <Select
                          value={overviewForm.roof_type}
                          onValueChange={(v) => setOverviewForm({ ...overviewForm, roof_type: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="shingle">Shingle</SelectItem>
                            <SelectItem value="metal">Metal</SelectItem>
                            <SelectItem value="tile">Tile</SelectItem>
                            <SelectItem value="flat">Flat</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Squares</Label>
                        <Input
                          type="number"
                          value={overviewForm.roof_squares}
                          onChange={(e) => setOverviewForm({ ...overviewForm, roof_squares: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground">Address</p>
                      <p className="font-medium">{deal.address}</p>
                    </div>
                    {deal.roof_type && (
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Roof Type</p>
                          <p className="font-medium capitalize">{deal.roof_type}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Squares</p>
                          <p className="font-medium">{deal.roof_squares_with_waste || deal.roof_squares || '-'}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Material Specifications */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Material Specifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <MaterialSpecificationsForm deal={deal} onSave={(data) => updateDealMutation.mutate(data)} />
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditingOverview ? (
                  <Textarea
                    value={overviewForm.notes}
                    onChange={(e) => setOverviewForm({ ...overviewForm, notes: e.target.value })}
                    placeholder="Add notes about this deal..."
                    rows={4}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {deal.notes || 'No notes yet'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Adjuster Meeting Checklist (show when in adjuster phase) */}
            {['claim_filed', 'adjuster_met'].includes(currentStatus) && (
              <Card className="border-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-primary">
                    <CheckCircle2 className="h-5 w-5" />
                    Adjuster Meeting Checklist
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {adjusterMeetingChecklist.map((item) => (
                      <div key={item.id} className="flex items-center gap-3">
                        <Checkbox id={item.id} />
                        <label
                          htmlFor={item.id}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {item.label}
                          {item.required && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    * Required items for a successful adjuster meeting
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Insurance Tab */}
          <TabsContent value="insurance" className="space-y-4 mt-4">
            {/* Insurance Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Insurance Details
                  </CardTitle>
                  {!isEditingInsurance ? (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingInsurance(true)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setIsEditingInsurance(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={handleSaveInsurance} disabled={updateDealMutation.isPending}>
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditingInsurance ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Insurance Company</Label>
                        <Input
                          value={insuranceForm.insurance_company}
                          onChange={(e) => setInsuranceForm({ ...insuranceForm, insurance_company: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Policy Number</Label>
                        <Input
                          value={insuranceForm.policy_number}
                          onChange={(e) => setInsuranceForm({ ...insuranceForm, policy_number: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Claim Number</Label>
                        <Input
                          value={insuranceForm.claim_number}
                          onChange={(e) => setInsuranceForm({ ...insuranceForm, claim_number: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Date of Loss</Label>
                        <Input
                          type="date"
                          value={insuranceForm.date_of_loss}
                          onChange={(e) => setInsuranceForm({ ...insuranceForm, date_of_loss: e.target.value })}
                        />
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Deductible</Label>
                        <Input
                          type="number"
                          value={insuranceForm.deductible}
                          onChange={(e) => setInsuranceForm({ ...insuranceForm, deductible: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>ACV (Actual Cash Value)</Label>
                        <Input
                          type="number"
                          value={insuranceForm.acv}
                          onChange={(e) => setInsuranceForm({ ...insuranceForm, acv: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Depreciation</Label>
                        <Input
                          type="number"
                          value={insuranceForm.depreciation}
                          onChange={(e) => setInsuranceForm({ ...insuranceForm, depreciation: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>RCV (Replacement Cost)</Label>
                        <Input
                          type="number"
                          value={insuranceForm.rcv}
                          onChange={(e) => setInsuranceForm({ ...insuranceForm, rcv: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Adjuster Name</Label>
                        <Input
                          value={insuranceForm.adjuster_name}
                          onChange={(e) => setInsuranceForm({ ...insuranceForm, adjuster_name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Adjuster Phone</Label>
                        <Input
                          type="tel"
                          value={insuranceForm.adjuster_phone}
                          onChange={(e) => setInsuranceForm({ ...insuranceForm, adjuster_phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Adjuster Meeting Date</Label>
                      <Input
                        type="date"
                        value={insuranceForm.adjuster_meeting_date}
                        onChange={(e) => setInsuranceForm({ ...insuranceForm, adjuster_meeting_date: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Insurance Company Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Insurance Company</p>
                        <p className="font-medium">{deal.insurance_company || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Policy Number</p>
                        <p className="font-medium">{deal.policy_number || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Claim Number</p>
                        <p className="font-medium">{deal.claim_number || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Date of Loss</p>
                        <p className="font-medium">
                          {deal.date_of_loss
                            ? new Date(deal.date_of_loss).toLocaleDateString()
                            : '-'}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    {/* Financial Details */}
                    <InsuranceCard
                      rcv={deal.rcv || 0}
                      acv={deal.acv || 0}
                      depreciation={deal.depreciation || 0}
                      deductible={deal.deductible || 0}
                      insuranceCompany={deal.insurance_company}
                      claimNumber={deal.claim_number}
                      acvCollected={deal.acv_check_collected}
                      depreciationCollected={deal.depreciation_check_collected}
                      salesTax={deal.sales_tax || undefined}
                      repTitlePercentage={deal.deal_commissions?.[0]?.commission_percent || repCommissionPercent}
                      repTitle={repCommissionLevelName || deal.deal_commissions?.[0]?.commission_type}
                      commissionAmount={deal.deal_commissions?.[0]?.commission_amount}
                      paymentRequested={deal.payment_requested || false}
                      paymentRequestDate={deal.payment_request_date || undefined}
                      onRequestPayment={handleRequestPayment}
                    />

                    {/* Adjuster Info */}
                    <Card className="bg-muted/30">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Adjuster Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Adjuster Name</p>
                            <p className="font-medium">{deal.adjuster_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Phone</p>
                            <p className="font-medium">{deal.adjuster_phone || '-'}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs text-muted-foreground">Meeting Date</p>
                            <p className="font-medium">
                              {deal.adjuster_meeting_date
                                ? new Date(deal.adjuster_meeting_date).toLocaleString()
                                : '-'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Key Dates */}
                    <Card className="bg-muted/30">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Key Dates</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Date of Loss</p>
                            <p className="font-medium">
                              {deal.date_of_loss
                                ? new Date(deal.date_of_loss).toLocaleDateString()
                                : '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Signed Date</p>
                            <p className="font-medium">
                              {deal.signed_date
                                ? new Date(deal.signed_date).toLocaleDateString()
                                : '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Install Date</p>
                            <p className="font-medium">
                              {deal.install_date
                                ? new Date(deal.install_date).toLocaleDateString()
                                : <span className="text-muted-foreground italic">Scheduled by Admin</span>}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Completion Date</p>
                            <p className="font-medium">
                              {deal.completion_date
                                ? new Date(deal.completion_date).toLocaleDateString()
                                : '-'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="docs" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Agreement - In-App Signing */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div className="flex items-center gap-3">
                    <FileSignature className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">Insurance Agreement</p>
                      <p className="text-xs text-muted-foreground">
                        {deal.contract_signed ? 'Signed on ' + (deal.signed_date ? new Date(deal.signed_date).toLocaleDateString() : 'N/A') : 'Not signed'}
                      </p>
                    </div>
                  </div>
                  {deal.contract_signed ? (
                    <Badge className="bg-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Signed
                    </Badge>
                  ) : currentStep >= 2 ? (
                    <Dialog open={showAgreement} onOpenChange={setShowAgreement}>
                      <DialogTrigger asChild>
                        <Button variant="default" size="sm">
                          <FileSignature className="h-4 w-4 mr-1" />
                          Sign Agreement
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <img src="/logo.png" alt="Titan Prime Solutions" className="h-8 w-8" />
                            Titan Prime Solutions - Insurance Agreement
                          </DialogTitle>
                        </DialogHeader>

                        {/* Agreement Content */}
                        <div className="space-y-4 text-sm">
                          <div className="bg-[#0F1E2E] text-white p-4 rounded-lg text-center">
                            <h2 className="text-xl font-bold">TITAN PRIME SOLUTIONS</h2>
                            <p className="text-xs opacity-80">INSURED & BONDED</p>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <Label>Homeowner Name</Label>
                              <p className="font-medium">{deal.homeowner_name}</p>
                            </div>
                            <div>
                              <Label>Date</Label>
                              <p className="font-medium">{new Date().toLocaleDateString()}</p>
                            </div>
                            <div className="col-span-2">
                              <Label>Address</Label>
                              <p className="font-medium">{deal.address}, {deal.city}, {deal.state} {deal.zip_code}</p>
                            </div>
                            <div>
                              <Label>Insurance Company</Label>
                              <p className="font-medium">{deal.insurance_company || '-'}</p>
                            </div>
                            <div>
                              <Label>Claim Number</Label>
                              <p className="font-medium">{deal.claim_number || '-'}</p>
                            </div>
                          </div>

                          <Separator />

                          <div className="prose prose-sm max-w-none">
                            <h3 className="text-base font-semibold">INSURANCE AGREEMENT</h3>
                            <p className="text-xs leading-relaxed">
                              This agreement is contingent upon the approval of your claim by your insurance company.
                              Upon claim approval, Titan Prime Solutions will perform the repairs or replacements
                              specified by the "loss statement" provided by your insurance company. Repairs will be
                              performed for insurance funds only, with the homeowner being responsible for paying their
                              insurance deductible.
                            </p>
                            <p className="text-xs leading-relaxed mt-2">
                              Any material upgrade or additional work authorized by the Homeowner will be an additional
                              charge to be paid for by the homeowner. The homeowner agrees to provide Titan Prime Solutions
                              with a copy of the insurance loss statement. In addition, Homeowner will pay Titan Prime Solutions
                              for any supplemental work approved by the insurance company for the amount of the insurance quote.
                            </p>
                            <p className="text-xs leading-relaxed mt-2">
                              If this agreement is canceled by the Homeowner after the three days right of rescission,
                              but after approval for the claim, the homeowner agrees to pay Titan Prime Solutions for
                              20% of the contract price outlined on the insurance loss statement as the "RCV" or
                              "Replacement Cost Value". This is not as a penalty, but as compensation for claim services
                              provided by the project manager up to the time of cancellation.
                            </p>
                          </div>

                          <div className="bg-muted p-3 rounded-lg">
                            <h4 className="font-semibold text-sm mb-2">3 DAY RIGHT OF RESCISSION</h4>
                            <p className="text-xs">
                              Homeowners shall have the right to cancel this contract within three (3) days after the
                              signing of the contract. Should the Homeowner decide to cancel the contract, the homeowner
                              must notify Titan Prime Solutions in writing. The notice of cancellation must be signed
                              and dated, and Homeowner must clearly state the intention to cancel.
                            </p>
                          </div>

                          <Separator />

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Square Footage</Label>
                              <Input
                                value={agreementForm.squareFootage || deal.roof_squares?.toString() || ''}
                                onChange={(e) => setAgreementForm({ ...agreementForm, squareFootage: e.target.value })}
                                placeholder="Square footage"
                              />
                            </div>
                            <div>
                              <Label>Shingle Color</Label>
                              <Input
                                value={agreementForm.shingleColor}
                                onChange={(e) => setAgreementForm({ ...agreementForm, shingleColor: e.target.value })}
                                placeholder="e.g., Weathered Wood"
                              />
                            </div>
                          </div>

                          <div className="bg-[#C9A24D]/10 border border-[#C9A24D]/30 p-3 rounded-lg">
                            <h4 className="font-semibold text-sm mb-2 text-[#C9A24D]">Warranty Information</h4>
                            <ul className="text-xs space-y-1">
                              <li>• 5 Year Labor Warranty provided by Titan Prime Solutions</li>
                              <li>• 30-Year Manufacturer Warranty (No Charge Upgrade) (110 Mph Wind Rated)</li>
                              <li>• 40 Year Manufacturer Warranty (No Charge Upgrade) (150 Mph Wind Rated) on Metal Panels</li>
                            </ul>
                          </div>

                          <div className="bg-destructive/10 border border-destructive/30 p-3 rounded-lg">
                            <p className="text-xs text-destructive font-medium">
                              **ROTTED OSB WILL COST AN ADDITIONAL $3.00 PER SQFT TO REPLACE.
                            </p>
                          </div>

                          <Separator />

                          <div>
                            <Label className="text-base font-semibold">Homeowner Signature</Label>
                            <p className="text-xs text-muted-foreground mb-2">
                              By signing below, I agree to and understand the terms above.
                            </p>
                            <SignaturePad
                              onSave={(dataUrl) => setSignatureDataUrl(dataUrl)}
                              onClear={() => setSignatureDataUrl(null)}
                            />
                          </div>

                          <div className="flex gap-3 pt-4">
                            <Button
                              variant="outline"
                              className="flex-1"
                              onClick={() => setShowAgreement(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              className="flex-1 bg-[#C9A24D] hover:bg-[#C9A24D]/90"
                              onClick={handleSignAgreement}
                              disabled={!signatureDataUrl || updateDealMutation.isPending}
                            >
                              <FileSignature className="h-4 w-4 mr-2" />
                              Sign Agreement
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Complete inspection first
                    </Badge>
                  )}
                </div>

                {/* Permit */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Permit</p>
                      <p className="text-xs text-muted-foreground">
                        {deal.permit_file_url ? 'Uploaded' : 'Not uploaded'}
                      </p>
                    </div>
                  </div>
                  {deal.permit_file_url ? (
                    <SecureDocumentLink
                      src={deal.permit_file_url}
                      className="flex items-center gap-2 p-2 bg-muted rounded-lg text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View Permit Document
                    </SecureDocumentLink>
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

                {/* Insurance Agreement Upload */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Insurance Agreement (Upload)</p>
                      <p className="text-xs text-muted-foreground">
                        {deal.insurance_agreement_url ? 'Uploaded' : 'Upload external insurance agreement'}
                      </p>
                    </div>
                  </div>
                  {deal.insurance_agreement_url ? (
                    <SecureDocumentLink
                      src={deal.insurance_agreement_url}
                      className="flex items-center gap-2 p-2 bg-muted rounded-lg text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View Insurance Agreement
                    </SecureDocumentLink>
                  ) : currentStep >= 2 ? (
                    <DocumentUpload
                      category="insurance-agreements"
                      dealId={deal.id}
                      label="Upload Insurance Agreement"
                      onUpload={(url) => {
                        updateDealMutation.mutate({
                          insurance_agreement_url: url,
                          contract_signed: true,
                          signed_date: deal.signed_date || new Date().toISOString(),
                        });
                      }}
                    />
                  ) : (
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">
                        Available after inspection
                      </p>
                    </div>
                  )}
                </div>

                {/* Lost Statement - Required for Full Approval */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Lost Statement</p>
                      <p className="text-xs text-muted-foreground">
                        {deal.lost_statement_url ? 'Uploaded' : 'Required for Full Approval'}
                      </p>
                    </div>
                    {deal.approval_type === 'full' && !deal.lost_statement_url && (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Required
                      </Badge>
                    )}
                  </div>
                  {deal.lost_statement_url ? (
                    <SecureDocumentLink
                      src={deal.lost_statement_url}
                      className="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg text-sm text-green-600 hover:underline"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      View Lost Statement
                    </SecureDocumentLink>
                  ) : currentStep >= 4 ? (
                    <DocumentUpload
                      category="lost-statements"
                      dealId={deal.id}
                      label="Upload Lost Statement"
                      onUpload={(url) => {
                        updateDealMutation.mutate({ lost_statement_url: url });
                      }}
                    />
                  ) : (
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">
                        Available after signing agreement
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Photos */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Photos
                  </h3>

                  {/* Inspection Photos */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Inspection Photos ({deal.inspection_images?.length || 0})</Label>
                    <ImageUpload
                      category="inspection-photos"
                      dealId={deal.id}
                      existingFiles={deal.inspection_images || []}
                      label="Add Inspection Photos"
                      onUpload={(url) => {
                        const currentImages = deal.inspection_images || [];
                        updateDealMutation.mutate({ inspection_images: [...currentImages, url] });
                      }}
                    />
                  </div>

                  {/* Inspection Report Generator */}
                  {deal.inspection_images && deal.inspection_images.length > 0 && (
                    <InspectionReportGenerator deal={deal} />
                  )}

                  {/* Install Photos - Available after install scheduled (step 9+) */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Install Photos ({deal.install_images?.length || 0})</Label>
                    {currentStep >= 9 ? (
                      <ImageUpload
                        category="install-photos"
                        dealId={deal.id}
                        existingFiles={deal.install_images || []}
                        label="Add Install Photos"
                        onUpload={(url) => {
                          const currentImages = deal.install_images || [];
                          updateDealMutation.mutate({ install_images: [...currentImages, url] });
                        }}
                      />
                    ) : (
                      <div className="p-3 rounded-lg bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground">
                          Available after install is scheduled
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Completion Photos - Available after installed (step 10+) */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Completion Photos ({deal.completion_images?.length || 0})</Label>
                    {currentStep >= 10 ? (
                      <ImageUpload
                        category="completion-photos"
                        dealId={deal.id}
                        existingFiles={deal.completion_images || []}
                        label="Add Completion Photos"
                        onUpload={(url) => {
                          const currentImages = deal.completion_images || [];
                          updateDealMutation.mutate({ completion_images: [...currentImages, url] });
                        }}
                      />
                    ) : (
                      <div className="p-3 rounded-lg bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground">
                          Available after installation is complete
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Receipts */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Payment Receipts
                  </h3>

                  {/* Show saved receipts */}
                  {(deal.acv_receipt_url || deal.deductible_receipt_url || deal.depreciation_receipt_url) && (
                    <div className="space-y-2 mb-3">
                      {deal.acv_receipt_url && (
                        <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600 dark:text-green-400">ACV Receipt Saved</span>
                        </div>
                      )}
                      {deal.deductible_receipt_url && (
                        <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600 dark:text-green-400">Deductible Receipt Saved</span>
                        </div>
                      )}
                      {deal.depreciation_receipt_url && (
                        <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600 dark:text-green-400">Depreciation Receipt Saved</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Only allow receipts after approval (step 6) */}
                  {currentStep >= 6 ? (
                    <>
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => navigate(`/deals/${deal.id}/receipts`)}
                      >
                        <Receipt className="h-4 w-4" />
                        Create Payment Receipt
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        Generate ACV, Deductible, or Depreciation receipts
                      </p>
                    </>
                  ) : (
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-sm text-muted-foreground">
                        Payment receipts will be available after insurance approval.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Current step: {config?.label || currentStatus}
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Invoice Section - Only available after install is complete */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Invoice
                  </h3>
                  {currentStep >= 10 ? (
                    <InvoiceGenerator
                      deal={deal}
                      onSave={() => {
                        queryClient.invalidateQueries({ queryKey: ['deal', dealId] });
                      }}
                    />
                  ) : (
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-sm text-muted-foreground">
                        Invoice generation will be available after installation is complete.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Current step: {config?.label || currentStatus}
                      </p>
                    </div>
                  )}
                </div>

                <Separator />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </RepLayout>
  );
}
