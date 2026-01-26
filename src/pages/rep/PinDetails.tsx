import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pinsApi, repsApi, uploadApi, dealsApi, Pin as AwsPin } from '@/integrations/aws/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  ChevronLeft, User, Phone, Mail, Trash2, Briefcase,
  CalendarIcon, Clock, X, Upload, FileText, Loader2, Users
} from 'lucide-react';
import { useAuth } from '@/contexts/AwsAuthContext';

type PinStatus = 'lead' | 'followup' | 'installed' | 'appointment' | 'renter' | 'not_interested';

// Local Pin interface for component
interface Pin {
  id: string;
  latitude: number;
  longitude: number;
  status: PinStatus;
  address: string | null;
  homeowner_name: string | null;
  homeowner_phone: string | null;
  homeowner_email: string | null;
  notes: string | null;
  created_at: string;
  deal_id: string | null;
  appointment_date: string | null;
  appointment_end_date: string | null;
  appointment_all_day: boolean | null;
  assigned_closer_id: string | null;
  rep_id: string;
  document_url: string | null;
}

// Convert AWS Pin to local format
function mapAwsPinToPin(awsPin: AwsPin): Pin {
  return {
    id: awsPin.id,
    latitude: awsPin.lat,
    longitude: awsPin.lng,
    status: awsPin.status as PinStatus,
    address: awsPin.address,
    homeowner_name: awsPin.homeowner_name,
    homeowner_phone: awsPin.homeowner_phone,
    homeowner_email: awsPin.homeowner_email,
    notes: awsPin.notes,
    created_at: awsPin.created_at,
    deal_id: awsPin.deal_id,
    appointment_date: awsPin.appointment_date,
    appointment_end_date: awsPin.appointment_end_date,
    appointment_all_day: awsPin.appointment_all_day,
    assigned_closer_id: awsPin.assigned_closer_id,
    rep_id: awsPin.rep_id,
    document_url: awsPin.document_url,
  };
}

interface RepProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
}

const statusConfig: Record<PinStatus, { color: string; label: string }> = {
  lead: { color: '#4A6FA5', label: 'Not Home' },           // Prime Steel Blue
  followup: { color: '#C9A24D', label: 'Needs Follow-up' }, // Prime Gold
  installed: { color: '#2E7D32', label: 'Installed' },      // Professional Green
  appointment: { color: '#C9A24D', label: 'Appointment' },  // Prime Gold
  renter: { color: '#78909C', label: 'Renter' },            // Gray Blue
  not_interested: { color: '#B71C1C', label: 'Not Interested' }, // Dark Red
};

export default function PinDetails() {
  const navigate = useNavigate();
  const { pinId } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const isNew = pinId === 'new';
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const initialAddress = searchParams.get('address');
  const fromTab = searchParams.get('from') || 'map';
  
  const getBackUrl = () => `/map?tab=${fromTab}`;

  const [formData, setFormData] = useState({
    status: 'lead' as PinStatus,
    address: initialAddress || '',
    homeowner_name: '',
    phone: '',
    email: '',
    notes: '',
    appointment_date: undefined as Date | undefined,
    appointment_time: '',
    appointment_end_time: '',
    appointment_all_day: false,
    assigned_closer_id: '',
  });

  // Fetch existing pin data
  const { data: pin, isLoading } = useQuery({
    queryKey: ['pin', pinId],
    queryFn: async () => {
      if (isNew) return null;
      const response = await pinsApi.get(pinId!);
      if (response.error) throw new Error(response.error);
      return response.data ? mapAwsPinToPin(response.data) : null;
    },
    enabled: !isNew && !!pinId,
  });

  // Get current user's rep_id from auth context
  const currentRepId = user?.sub;

  // Fetch current user's rep info to check commission level
  const { data: currentUserRep } = useQuery({
    queryKey: ['current-user-rep', currentRepId],
    queryFn: async () => {
      const response = await repsApi.list();
      if (response.error) throw new Error(response.error);
      // list() returns only the current user's rep for non-admins
      return response.data?.[0] || null;
    },
    enabled: !!currentRepId,
  });

  // Check if current user is junior level (requires closer)
  const isJuniorRep = currentUserRep?.commission_level === 'junior';

  // Fetch senior/manager reps for closer assignment
  const { data: reps } = useQuery({
    queryKey: ['closers-for-assignment'],
    queryFn: async () => {
      const response = await repsApi.listClosers();
      if (response.error) throw new Error(response.error);
      return (response.data || []).map(rep => ({
        id: rep.id,
        user_id: rep.user_id,
        full_name: rep.full_name,
        email: rep.email,
      })) as RepProfile[];
    },
  });

  // Upload document handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pinId || isNew) return;

    setIsUploading(true);
    try {
      // Get presigned upload URL from AWS
      const urlResponse = await uploadApi.getUploadUrl(file.name, file.type, `pins/${pinId}`);
      if (urlResponse.error) throw new Error(urlResponse.error);

      const { url, key } = urlResponse.data!;

      // Upload file directly to S3
      const uploadResponse = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) throw new Error('Failed to upload file');

      // Update pin with document URL
      const updateResponse = await pinsApi.update(pinId, { document_url: key });
      if (updateResponse.error) throw new Error(updateResponse.error);

      toast.success('Document uploaded');
      queryClient.invalidateQueries({ queryKey: ['pin', pinId] });
    } catch (error) {
      toast.error('Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Delete document handler
  const handleDeleteDocument = async () => {
    if (!pinId) return;
    try {
      // Update pin to remove document URL
      const response = await pinsApi.update(pinId, { document_url: null });
      if (response.error) throw new Error(response.error);

      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['pin', pinId] });
    } catch (error) {
      toast.error('Delete failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Populate form when pin data loads
  useEffect(() => {
    if (pin) {
      setFormData({
        status: pin.status,
        address: pin.address || '',
        homeowner_name: pin.homeowner_name || '',
        phone: pin.homeowner_phone || '',
        email: pin.homeowner_email || '',
        notes: pin.notes || '',
        appointment_date: pin.appointment_date ? new Date(pin.appointment_date) : undefined,
        appointment_time: pin.appointment_date ? format(new Date(pin.appointment_date), 'HH:mm') : '',
        appointment_end_time: pin.appointment_end_date ? format(new Date(pin.appointment_end_date), 'HH:mm') : '',
        appointment_all_day: pin.appointment_all_day || false,
        assigned_closer_id: pin.assigned_closer_id || '',
      });
    }
  }, [pin]);

  const createPinMutation = useMutation({
    mutationFn: async (data: { 
      lat: number; 
      lng: number; 
      status: PinStatus; 
      address: string; 
      homeowner_name: string; 
      homeowner_phone: string;
      homeowner_email: string;
      notes: string;
      appointment_date: string | null;
      appointment_end_date: string | null;
      appointment_all_day: boolean;
      assigned_closer_id: string | null;
    }) => {
      const response = await pinsApi.create({
        lat: data.lat,
        lng: data.lng,
        status: data.status,
        address: data.address || '',
        homeowner_name: data.homeowner_name || '',
        homeowner_phone: data.homeowner_phone || null,
        homeowner_email: data.homeowner_email || null,
        notes: data.notes || null,
        appointment_date: data.appointment_date,
        assigned_closer_id: data.assigned_closer_id,
      });
      if (response.error) throw new Error(response.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rep-pins'] });
      toast.success('Pin added successfully');
      navigate(getBackUrl());
    },
    onError: (error) => {
      toast.error('Failed to add pin: ' + error.message);
    },
  });

  const updatePinMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AwsPin> }) => {
      const response = await pinsApi.update(id, updates);
      if (response.error) throw new Error(response.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rep-pins'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-date-appointments'] });
      toast.success('Pin updated');
      navigate(getBackUrl());
    },
    onError: (error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  const deletePinMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await pinsApi.delete(id);
      if (response.error) throw new Error(response.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rep-pins'] });
      toast.success('Pin deleted');
      navigate(getBackUrl());
    },
    onError: (error) => {
      toast.error('Failed to delete: ' + error.message);
    },
  });

  // Convert pin to deal via AWS API
  const convertToDealMutation = useMutation({
    mutationFn: async (pinData: Pin) => {
      const response = await dealsApi.createFromPin(pinData.id);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rep-pins'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Deal created successfully!');
      navigate(getBackUrl());
    },
    onError: (error) => {
      toast.error('Failed to create deal: ' + error.message);
    },
  });

  const getAppointmentDateTime = (): string | null => {
    if (formData.status !== 'appointment' || !formData.appointment_date) return null;
    if (formData.appointment_all_day) {
      // For all day, set to midnight
      const dateTime = new Date(formData.appointment_date);
      dateTime.setHours(0, 0, 0, 0);
      return dateTime.toISOString();
    }
    
    const date = formData.appointment_date;
    const time = formData.appointment_time || '09:00';
    const [hours, minutes] = time.split(':').map(Number);
    
    const dateTime = new Date(date);
    dateTime.setHours(hours, minutes, 0, 0);
    
    return dateTime.toISOString();
  };

  const getAppointmentEndDateTime = (): string | null => {
    if (formData.status !== 'appointment' || !formData.appointment_date) return null;
    if (formData.appointment_all_day) return null;
    if (!formData.appointment_end_time) return null;
    
    const date = formData.appointment_date;
    const time = formData.appointment_end_time;
    const [hours, minutes] = time.split(':').map(Number);
    
    const dateTime = new Date(date);
    dateTime.setHours(hours, minutes, 0, 0);
    
    return dateTime.toISOString();
  };

  const handleSave = () => {
    // Validate: Junior reps must assign a closer for appointments
    if (isJuniorRep && formData.status === 'appointment' && !formData.assigned_closer_id) {
      toast.error('As an entry-level rep, you must assign a closer for appointments');
      return;
    }

    const appointmentDateTime = getAppointmentDateTime();

    if (isNew && lat && lng) {
      const appointmentEndDateTime = getAppointmentEndDateTime();
      createPinMutation.mutate({
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        status: formData.status,
        address: formData.address,
        homeowner_name: formData.homeowner_name,
        homeowner_phone: formData.phone,
        homeowner_email: formData.email,
        notes: formData.notes,
        appointment_date: appointmentDateTime,
        appointment_end_date: appointmentEndDateTime,
        appointment_all_day: formData.appointment_all_day,
        assigned_closer_id: formData.assigned_closer_id || null,
      });
    } else if (pin) {
      const appointmentEndDateTime = getAppointmentEndDateTime();
      updatePinMutation.mutate({
        id: pin.id,
        updates: {
          status: formData.status,
          address: formData.address || '',
          homeowner_name: formData.homeowner_name || '',
          homeowner_phone: formData.phone || null,
          homeowner_email: formData.email || null,
          notes: formData.notes || null,
          appointment_date: appointmentDateTime,
          appointment_end_date: appointmentEndDateTime,
          appointment_all_day: formData.appointment_all_day,
          assigned_closer_id: formData.assigned_closer_id || null,
        },
      });
    }
  };

  if (!isNew && isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <div 
        className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <button
          onClick={() => navigate(getBackUrl())}
          className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">
          {isNew ? 'New Pin' : 'Pin Details'}
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4 max-w-lg mx-auto">
          {/* Address Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Address</span>
            {!isNew && pin?.deal_id && (
              <span className="text-xs text-primary flex items-center gap-1">
                <Briefcase className="w-3 h-3" />
                Linked to Deal
              </span>
            )}
          </div>

          {/* Address Display */}
          <div className="relative">
            <div className="p-3 bg-muted rounded-lg pr-10">
              <p className="text-sm text-foreground">{formData.address || 'No address'}</p>
            </div>
            {formData.address && (
              <button
                onClick={() => setFormData({ ...formData, address: '' })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Pills */}
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2 pb-2">
              {(Object.keys(statusConfig) as PinStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setFormData({ ...formData, status })}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full transition-colors shrink-0 ${
                    formData.status === status
                      ? 'bg-muted border-2 border-primary'
                      : 'bg-muted border-2 border-transparent'
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: statusConfig[status].color }}
                  />
                  <span className="text-xs font-medium text-foreground">{statusConfig[status].label}</span>
                </button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {/* Appointment Date/Time */}
          {formData.status === 'appointment' && (
            <div className="space-y-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Schedule Appointment</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="all-day" className="text-[10px] text-muted-foreground">All Day</Label>
                  <Switch
                    id="all-day"
                    checked={formData.appointment_all_day}
                    onCheckedChange={(checked) => setFormData({ ...formData, appointment_all_day: checked })}
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <Label className="text-muted-foreground text-[10px]">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-9 text-sm bg-muted border-0",
                        !formData.appointment_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                      {formData.appointment_date ? format(formData.appointment_date, "MMM d, yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.appointment_date}
                      onSelect={(date) => setFormData({ ...formData, appointment_date: date })}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              {!formData.appointment_all_day && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-[10px]">From</Label>
                    <div className="relative h-9 flex items-center bg-muted rounded-md px-3">
                      <Input
                        type="time"
                        value={formData.appointment_time}
                        onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
                        className="bg-transparent border-0 h-9 text-sm p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <Clock className="w-3.5 h-3.5 text-muted-foreground pointer-events-none ml-auto shrink-0" />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-[10px]">To</Label>
                    <div className="relative h-9 flex items-center bg-muted rounded-md px-3">
                      <Input
                        type="time"
                        value={formData.appointment_end_time}
                        onChange={(e) => setFormData({ ...formData, appointment_end_time: e.target.value })}
                        className="bg-transparent border-0 h-9 text-sm p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <Clock className="w-3.5 h-3.5 text-muted-foreground pointer-events-none ml-auto shrink-0" />
                    </div>
                  </div>
                </div>
              )}

              {/* Assign Closer */}
              <div className="space-y-1 pt-2 border-t border-primary/20">
                <Label className="text-muted-foreground text-[10px] flex items-center gap-1.5">
                  <Users className="w-3 h-3" />
                  Assign Closer {isJuniorRep ? <span className="text-red-500">*</span> : '(optional)'}
                </Label>
                <Select 
                  value={formData.assigned_closer_id} 
                  onValueChange={(value) => setFormData({ ...formData, assigned_closer_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger className={`bg-muted border-0 h-9 text-sm ${isJuniorRep && !formData.assigned_closer_id ? 'border border-red-500/50' : ''}`}>
                    <SelectValue placeholder="Select a closer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {!isJuniorRep && <SelectItem value="none">No closer assigned</SelectItem>}
                    {reps && reps.length > 0 ? (
                      reps.map((rep) => (
                        <SelectItem key={rep.id} value={rep.id}>
                          {rep.full_name || rep.email || 'Unknown'}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No senior/manager reps available
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {isJuniorRep
                    ? 'As an entry-level rep, you must assign a closer for all appointments.'
                    : 'The assigned closer will see this appointment on their calendar.'}
                </p>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Full Name</Label>
              <div className="relative">
                <Input
                  value={formData.homeowner_name}
                  onChange={(e) => setFormData({ ...formData, homeowner_name: e.target.value })}
                  placeholder=""
                  className="pr-10 bg-muted border-0 h-10 text-sm"
                />
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Phone Number</Label>
              <div className="relative">
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder=""
                  className="pr-10 bg-muted border-0 h-10 text-sm"
                />
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Email</Label>
              <div className="relative">
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder=""
                  className="pr-10 bg-muted border-0 h-10 text-sm"
                />
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Note</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder=""
                className="bg-muted border-0 min-h-[80px] resize-none text-sm"
              />
            </div>
          </div>

          {/* Documents Section (only for existing pins) */}
          {!isNew && pinId && (
            <div className="space-y-3 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <Label className="text-muted-foreground text-xs">Documents</Label>
                <span className="text-xs text-muted-foreground">
                  {pin?.document_url ? '1 file' : '0 files'}
                </span>
              </div>

              {/* Upload Button */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full h-10 border-dashed"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || !!pin?.document_url}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    {pin?.document_url ? 'Document Already Uploaded' : 'Upload Document'}
                  </>
                )}
              </Button>

              {/* Document Display */}
              {pin?.document_url && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <FileText className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate block">
                        Uploaded Document
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteDocument()}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons (only for existing pins) */}
          {!isNew && pin && (
            <div className="space-y-3 pt-2">
              {!pin.deal_id && (
                <Button
                  variant="default"
                  className="w-full h-10"
                  onClick={() => convertToDealMutation.mutate(pin)}
                  disabled={convertToDealMutation.isPending}
                >
                  <Briefcase className="w-4 h-4 mr-2" />
                  {convertToDealMutation.isPending ? 'Creating Deal...' : 'Turn into Deal'}
                </Button>
              )}

              {pin.deal_id && (
                <div className="flex items-center justify-center gap-2 py-3 px-4 bg-primary/10 rounded-lg text-primary">
                  <Briefcase className="w-4 h-4" />
                  <span className="text-sm font-medium">Already a Deal</span>
                </div>
              )}

              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => deletePinMutation.mutate(pin.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Pin
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Save Button - Fixed at bottom */}
      <div 
        className="flex-shrink-0 p-4 bg-background border-t border-border"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        <Button
          onClick={handleSave}
          disabled={createPinMutation.isPending || updatePinMutation.isPending}
          className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-full"
        >
          {createPinMutation.isPending || updatePinMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
