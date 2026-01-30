import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pinsApi } from "@/integrations/aws/api";
import { useAuth } from "@/contexts/AwsAuthContext";
import { RepLayout } from "@/components/RepLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ChevronLeft, MapPin, User, Calendar, Clock } from "lucide-react";

export default function AddAppointment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    homeowner_name: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    appointment_date: "",
    appointment_time: "",
    appointment_end_time: "",
    all_day: false,
    notes: "",
  });

  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Get user's rep ID
  const [repId, setRepId] = useState<string | null>(null);

  useEffect(() => {
    const getRepId = async () => {
      if (!user?.sub) return;
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/reps/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setRepId(data.id);
        }
      } catch (error) {
        console.error('Failed to get rep ID:', error);
      }
    };
    getRepId();
  }, [user]);

  // Initialize form with current date and time
  useEffect(() => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000); // Add 1 hour

    setFormData(prev => ({
      ...prev,
      appointment_date: now.toISOString().split('T')[0], // YYYY-MM-DD format
      appointment_time: now.toTimeString().slice(0, 5), // HH:MM format
      appointment_end_time: oneHourLater.toTimeString().slice(0, 5), // HH:MM format
    }));
  }, []);

  const handleAddressChange = async (value: string) => {
    setFormData(prev => ({ ...prev, address: value }));

    if (value.length > 3) {
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?access_token=${import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}&types=address&limit=5&country=US`
        );
        const data = await response.json();
        setAddressSuggestions(data.features || []);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Address geocoding error:', error);
      }
    } else {
      setAddressSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleAddressSelect = (feature: any) => {
    const [lng, lat] = feature.center;
    const context = feature.context || [];
    const city = context.find((c: any) => c.id.includes('place'))?.text || '';
    const state = context.find((c: any) => c.id.includes('region'))?.text || '';
    const zip = context.find((c: any) => c.id.includes('postcode'))?.text || '';

    setFormData(prev => ({
      ...prev,
      address: feature.place_name.replace(', United States', ''),
      city,
      state,
      zip_code: zip,
    }));
    setShowSuggestions(false);
  };

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const token = await user!.getIdToken();
      const appointmentData = {
        rep_id: repId,
        homeowner_name: data.homeowner_name,
        address: data.address,
        city: data.city,
        state: data.state,
        zip_code: data.zip_code,
        latitude: 0, // Will be set by backend or updated later
        longitude: 0, // Will be set by backend or updated later
        status: 'appointment' as const,
        appointment_date: data.appointment_date ? `${data.appointment_date}T${data.appointment_time || '09:00'}:00` : null,
        appointment_end_date: data.appointment_end_time ? `${data.appointment_date}T${data.appointment_end_time}:00` : null,
        appointment_all_day: data.all_day,
        notes: data.notes,
      };

      const result = await pinsApi.create(appointmentData);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pins'] });
      toast.success('Appointment created successfully!');
      navigate('/calendar');
    },
    onError: (error: Error) => {
      toast.error('Failed to create appointment', { description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.homeowner_name.trim()) {
      toast.error('Homeowner name is required');
      return;
    }
    if (!formData.address.trim()) {
      toast.error('Address is required');
      return;
    }
    if (!formData.appointment_date) {
      toast.error('Appointment date is required');
      return;
    }
    createAppointmentMutation.mutate(formData);
  };

  // Helper function to add 1 hour to a time string
  const addOneHour = (timeString: string): string => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + 60; // Add 1 hour (60 minutes)
    const newHours = Math.floor(totalMinutes / 60) % 24; // Wrap around 24 hours
    const newMinutes = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
  };

  return (
    <RepLayout title="Add Appointment" showBackButton onBack={() => navigate('/calendar')}>
      <div className="p-4 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Homeowner Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5" />
              Homeowner Information
            </h3>

            <div>
              <Label htmlFor="homeowner_name">Homeowner Name *</Label>
              <Input
                id="homeowner_name"
                value={formData.homeowner_name}
                onChange={(e) => setFormData(prev => ({ ...prev, homeowner_name: e.target.value }))}
                placeholder="Enter homeowner name"
                required
              />
            </div>
          </div>

          {/* Address Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Property Address
            </h3>

            <div className="relative">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleAddressChange(e.target.value)}
                placeholder="Enter full address"
                required
              />
              {showSuggestions && addressSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {addressSuggestions.map((feature, index) => (
                    <button
                      key={index}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted focus:bg-muted focus:outline-none"
                      onClick={() => handleAddressSelect(feature)}
                    >
                      <div className="text-sm">{feature.place_name.replace(', United States', '')}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="City"
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                  placeholder="State"
                />
              </div>
              <div>
                <Label htmlFor="zip_code">ZIP</Label>
                <Input
                  id="zip_code"
                  value={formData.zip_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, zip_code: e.target.value }))}
                  placeholder="ZIP"
                />
              </div>
            </div>
          </div>

          {/* Appointment Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Appointment Details
            </h3>

            <div>
              <Label htmlFor="appointment_date">Date *</Label>
              <Input
                id="appointment_date"
                type="date"
                value={formData.appointment_date}
                onChange={(e) => setFormData(prev => ({ ...prev, appointment_date: e.target.value }))}
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="all_day"
                checked={formData.all_day}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, all_day: !!checked }))}
              />
              <Label htmlFor="all_day">All day appointment</Label>
            </div>

            {!formData.all_day && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="appointment_time">Start Time</Label>
                  <Input
                    id="appointment_time"
                    type="time"
                    value={formData.appointment_time}
                    onChange={(e) => {
                      const newStartTime = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        appointment_time: newStartTime,
                        appointment_end_time: addOneHour(newStartTime)
                      }));
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="appointment_end_time">End Time</Label>
                  <Input
                    id="appointment_end_time"
                    type="time"
                    value={formData.appointment_end_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, appointment_end_time: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Notes</h3>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add any notes about this appointment..."
              rows={4}
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => navigate('/calendar')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={createAppointmentMutation.isPending}
            >
              {createAppointmentMutation.isPending ? 'Creating...' : 'Create Appointment'}
            </Button>
          </div>
        </form>
      </div>
    </RepLayout>
  );
}
