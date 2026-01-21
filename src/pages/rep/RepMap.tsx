import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { RepLayout } from '@/components/RepLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Trash2, MapPin } from 'lucide-react';

// Fix Leaflet default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

type PinStatus = 'lead' | 'followup' | 'installed';

interface Pin {
  id: string;
  latitude: number;
  longitude: number;
  status: PinStatus;
  address: string | null;
  homeowner_name: string | null;
  notes: string | null;
  created_at: string;
}

const statusColors: Record<PinStatus, string> = {
  lead: '#f59e0b',
  followup: '#3b82f6',
  installed: '#22c55e',
};

const statusLabels: Record<PinStatus, string> = {
  lead: 'Lead',
  followup: 'Follow-up',
  installed: 'Installed',
};

// Create custom colored markers
const createIcon = (status: PinStatus) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${statusColors[status]};
      width: 24px;
      height: 24px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  });
};

interface NewPinData {
  lat: number;
  lng: number;
}

function MapClickHandler({ onMapClick }: { onMapClick: (latlng: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

export default function RepMap() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPin, setNewPin] = useState<NewPinData | null>(null);
  const [formData, setFormData] = useState({
    status: 'lead' as PinStatus,
    address: '',
    homeowner_name: '',
    notes: '',
  });
  const [userLocation, setUserLocation] = useState<[number, number]>([39.8283, -98.5795]); // Center of US
  const queryClient = useQueryClient();

  // Get user's location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        () => {
          // Default to center of US if location denied
        }
      );
    }
  }, []);

  // Fetch rep's pins
  const { data: pins, isLoading } = useQuery({
    queryKey: ['rep-pins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rep_pins')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Pin[];
    },
  });

  // Get rep_id for creating pins
  const { data: repData } = useQuery({
    queryKey: ['current-rep'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_rep_id');
      if (error) throw error;
      return data;
    },
  });

  const createPinMutation = useMutation({
    mutationFn: async (data: { lat: number; lng: number; status: PinStatus; address: string; homeowner_name: string; notes: string }) => {
      const { error } = await supabase.from('rep_pins').insert({
        rep_id: repData,
        latitude: data.lat,
        longitude: data.lng,
        status: data.status,
        address: data.address || null,
        homeowner_name: data.homeowner_name || null,
        notes: data.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rep-pins'] });
      setIsDialogOpen(false);
      setNewPin(null);
      resetForm();
      toast.success('Pin added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add pin: ' + error.message);
    },
  });

  const updatePinMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PinStatus }) => {
      const { error } = await supabase.from('rep_pins').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rep-pins'] });
      toast.success('Pin updated');
    },
    onError: (error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  const deletePinMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rep_pins').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rep-pins'] });
      toast.success('Pin deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({ status: 'lead', address: '', homeowner_name: '', notes: '' });
  };

  const handleMapClick = (latlng: { lat: number; lng: number }) => {
    setNewPin({ lat: latlng.lat, lng: latlng.lng });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin) return;
    createPinMutation.mutate({
      lat: newPin.lat,
      lng: newPin.lng,
      ...formData,
    });
  };

  return (
    <RepLayout title="My Map">
      <div className="flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
        {/* Legend */}
        <div className="flex items-center gap-4 p-3 bg-card border-b border-border flex-shrink-0">
          <span className="text-xs text-muted-foreground">Tap map to add pin:</span>
          {(['lead', 'followup', 'installed'] as PinStatus[]).map((status) => (
            <div key={status} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: statusColors[status] }}
              />
              <span className="text-xs">{statusLabels[status]}</span>
            </div>
          ))}
        </div>

        {/* Map */}
        <div className="flex-1 relative" style={{ minHeight: '400px' }}>
          <MapContainer
            center={userLocation}
            zoom={17}
            scrollWheelZoom={true}
            className="absolute inset-0"
            style={{ height: '100%', width: '100%', zIndex: 1 }}
          >
            {/* Esri World Imagery - FREE satellite tiles, great for house-level detail */}
            <TileLayer
              attribution='&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
            {/* Labels overlay for street names */}
            <TileLayer
              attribution=''
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
            <MapClickHandler onMapClick={handleMapClick} />
            
            {pins?.map((pin) => (
              <Marker
                key={pin.id}
                position={[pin.latitude, pin.longitude]}
                icon={createIcon(pin.status)}
              >
                <Popup>
                  <div className="min-w-[200px] space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge
                        style={{ backgroundColor: statusColors[pin.status] }}
                        className="text-white"
                      >
                        {statusLabels[pin.status]}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => deletePinMutation.mutate(pin.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    
                    {pin.homeowner_name && (
                      <p className="font-medium text-sm">{pin.homeowner_name}</p>
                    )}
                    {pin.address && (
                      <p className="text-xs text-muted-foreground">{pin.address}</p>
                    )}
                    {pin.notes && (
                      <p className="text-xs">{pin.notes}</p>
                    )}
                    
                    <div className="flex gap-1 pt-1">
                      {(['lead', 'followup', 'installed'] as PinStatus[]).map((status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant={pin.status === status ? 'default' : 'outline'}
                          className="text-xs h-6 px-2"
                          style={pin.status === status ? { backgroundColor: statusColors[status] } : {}}
                          onClick={() => updatePinMutation.mutate({ id: pin.id, status })}
                        >
                          {statusLabels[status]}
                        </Button>
                      ))}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Add Pin Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Add New Pin
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v as PinStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="followup">Follow-up</SelectItem>
                  <SelectItem value="installed">Installed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Address (optional)</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St"
              />
            </div>

            <div className="space-y-2">
              <Label>Homeowner Name (optional)</Label>
              <Input
                value={formData.homeowner_name}
                onChange={(e) => setFormData({ ...formData, homeowner_name: e.target.value })}
                placeholder="John Smith"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any notes about this location..."
                rows={2}
              />
            </div>

            <Button type="submit" className="w-full" disabled={createPinMutation.isPending}>
              {createPinMutation.isPending ? 'Adding...' : 'Add Pin'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </RepLayout>
  );
}
