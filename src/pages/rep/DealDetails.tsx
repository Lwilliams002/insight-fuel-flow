import { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dealsApi } from '@/integrations/aws/api';
import { RepLayout } from '@/components/RepLayout';
import { DealPipeline, InsuranceCard } from '@/components/DealCRMComponents';
import { MilestoneProgressTracker } from '@/components/crm/MilestoneProgressTracker';
import { DealStatus, dealStatusConfig, adjusterMeetingChecklist } from '@/lib/crmProcess';
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
import {
  ChevronLeft,
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
  Shield
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

  // Update deal mutation
  const updateDealMutation = useMutation({
    mutationFn: async (updates: Partial<typeof deal>) => {
      const result = await dealsApi.update(dealId!, updates);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] });
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
    updateDealMutation.mutate({
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
    });
  };

  // Sign agreement
  const handleSignAgreement = () => {
    if (!signatureDataUrl) {
      toast.error('Please provide a signature');
      return;
    }
    updateDealMutation.mutate({
      contract_signed: true,
      signed_date: new Date().toISOString().split('T')[0],
      agreement_document_url: signatureDataUrl, // Store signature as data URL for now
    });
    setShowAgreement(false);
    toast.success('Agreement signed successfully!');
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

  return (
    <RepLayout title="Deal Details" showBackButton onBack={() => navigate('/deals')}>
      <div className="p-4 pb-24 space-y-4">
        {/* Milestone Progress Tracker - moved to top for better visibility */}
        <MilestoneProgressTracker currentStatus={currentStatus} />

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
            {['adjuster_scheduled', 'adjuster_met'].includes(currentStatus) && (
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
                        <Label>RCV (Replacement Cost)</Label>
                        <Input
                          type="number"
                          value={insuranceForm.rcv}
                          onChange={(e) => setInsuranceForm({ ...insuranceForm, rcv: e.target.value })}
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
                        <Label>Deductible</Label>
                        <Input
                          type="number"
                          value={insuranceForm.deductible}
                          onChange={(e) => setInsuranceForm({ ...insuranceForm, deductible: e.target.value })}
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
                                : '-'}
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
                  ) : (
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
                  )}
                </div>

                {/* Permit */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">Permit</p>
                      <p className="text-xs text-muted-foreground">
                        {deal.permit_file_url ? 'Uploaded' : 'Not uploaded'}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    {deal.permit_file_url ? 'View' : 'Upload'}
                  </Button>
                </div>

                <Separator />

                {/* Photos */}
                <div>
                  <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Photos
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-20 flex-col gap-1">
                      <Camera className="h-5 w-5" />
                      <span className="text-xs">Inspection Photos</span>
                      <span className="text-xs text-muted-foreground">
                        {deal.inspection_images?.length || 0} photos
                      </span>
                    </Button>
                    <Button variant="outline" className="h-20 flex-col gap-1">
                      <Camera className="h-5 w-5" />
                      <span className="text-xs">Install Photos</span>
                      <span className="text-xs text-muted-foreground">
                        {deal.install_images?.length || 0} photos
                      </span>
                    </Button>
                    <Button variant="outline" className="h-20 flex-col gap-1">
                      <Camera className="h-5 w-5" />
                      <span className="text-xs">Completion Photos</span>
                      <span className="text-xs text-muted-foreground">
                        {deal.completion_images?.length || 0} photos
                      </span>
                    </Button>
                  </div>
                </div>

                {/* Receipt */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">Receipt</p>
                      <p className="text-xs text-muted-foreground">
                        {deal.receipt_file_url ? 'Uploaded' : 'Not uploaded'}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    {deal.receipt_file_url ? 'View' : 'Upload'}
                  </Button>
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
