import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Search, MapPin, SlidersHorizontal, Crosshair, Layers, 
  X, User, Phone, Mail, Trash2, List, Map, Briefcase
} from 'lucide-react';

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
  deal_id: string | null;
}

const statusConfig: Record<PinStatus, { color: string; label: string }> = {
  lead: { color: '#a855f7', label: 'Not Home' },
  followup: { color: '#ec4899', label: 'Needs Follow-up' },
  installed: { color: '#14b8a6', label: 'Installed' },
};

// Create custom colored markers
const createIcon = (status: PinStatus) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${statusConfig[status].color};
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        width: 10px;
        height: 10px;
        background: white;
        border-radius: 50%;
        opacity: 0.9;
      "></div>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

interface NewPinData {
  lat: number;
  lng: number;
}

function MapLongPressHandler({ onLongPress }: { onLongPress: (latlng: { lat: number; lng: number }) => void }) {
  const map = useMap();
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressPosition = useRef<L.LatLng | null>(null);

  useEffect(() => {
    const container = map.getContainer();

    const clearTimer = () => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
    };

    const handleStart = (e: MouseEvent | TouchEvent) => {
      let latlng: L.LatLng;
      if ('touches' in e) {
        const touch = e.touches[0];
        const point = map.containerPointToLatLng([touch.clientX - container.getBoundingClientRect().left, touch.clientY - container.getBoundingClientRect().top]);
        latlng = point;
      } else {
        const point = map.containerPointToLatLng([e.clientX - container.getBoundingClientRect().left, e.clientY - container.getBoundingClientRect().top]);
        latlng = point;
      }
      
      pressPosition.current = latlng;
      pressTimer.current = setTimeout(() => {
        if (pressPosition.current) {
          onLongPress({ lat: pressPosition.current.lat, lng: pressPosition.current.lng });
        }
      }, 600);
    };

    const handleEnd = () => clearTimer();
    const handleMove = () => clearTimer();

    container.addEventListener('mousedown', handleStart);
    container.addEventListener('mouseup', handleEnd);
    container.addEventListener('mouseleave', handleEnd);
    container.addEventListener('mousemove', handleMove);
    container.addEventListener('touchstart', handleStart, { passive: true });
    container.addEventListener('touchend', handleEnd);
    container.addEventListener('touchmove', handleMove, { passive: true });

    return () => {
      container.removeEventListener('mousedown', handleStart);
      container.removeEventListener('mouseup', handleEnd);
      container.removeEventListener('mouseleave', handleEnd);
      container.removeEventListener('mousemove', handleMove);
      container.removeEventListener('touchstart', handleStart);
      container.removeEventListener('touchend', handleEnd);
      container.removeEventListener('touchmove', handleMove);
      clearTimer();
    };
  }, [map, onLongPress]);

  return null;
}

function LocateButton({ userLocation }: { userLocation: [number, number] }) {
  const map = useMap();
  
  const handleLocate = () => {
    map.flyTo(userLocation, 18, { duration: 1 });
  };

  return (
    <button
      onClick={handleLocate}
      className="w-11 h-11 rounded-full bg-card/95 backdrop-blur-sm border border-border shadow-lg flex items-center justify-center text-foreground hover:bg-muted transition-colors"
    >
      <Crosshair className="w-5 h-5" />
    </button>
  );
}

function MapControls({ 
  userLocation, 
  onToggleView 
}: { 
  userLocation: [number, number];
  onToggleView: () => void;
}) {
  const map = useMap();

  const handleLocate = () => {
    map.flyTo(userLocation, 18, { duration: 1 });
  };

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-2">
      <button
        onClick={() => {}}
        className="w-11 h-11 rounded-full bg-card/95 backdrop-blur-sm border border-border shadow-lg flex items-center justify-center text-foreground hover:bg-muted transition-colors"
        title="Search"
      >
        <Search className="w-5 h-5" />
      </button>
      <button
        onClick={() => {}}
        className="w-11 h-11 rounded-full bg-card/95 backdrop-blur-sm border border-border shadow-lg flex items-center justify-center text-foreground hover:bg-muted transition-colors"
        title="Drop Pin"
      >
        <MapPin className="w-5 h-5" />
      </button>
      <button
        onClick={() => {}}
        className="w-11 h-11 rounded-full bg-card/95 backdrop-blur-sm border border-border shadow-lg flex items-center justify-center text-foreground hover:bg-muted transition-colors"
        title="Filter"
      >
        <SlidersHorizontal className="w-5 h-5" />
      </button>
      <button
        onClick={handleLocate}
        className="w-11 h-11 rounded-full bg-card/95 backdrop-blur-sm border border-border shadow-lg flex items-center justify-center text-foreground hover:bg-muted transition-colors"
        title="My Location"
      >
        <Crosshair className="w-5 h-5" />
      </button>
      <button
        onClick={() => {}}
        className="w-11 h-11 rounded-full bg-card/95 backdrop-blur-sm border border-border shadow-lg flex items-center justify-center text-foreground hover:bg-muted transition-colors"
        title="Layers"
      >
        <Layers className="w-5 h-5" />
      </button>
    </div>
  );
}

export default function RepMap() {
  const [activeView, setActiveView] = useState<'map' | 'list'>('map');
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [newPin, setNewPin] = useState<NewPinData | null>(null);
  const [formData, setFormData] = useState({
    status: 'lead' as PinStatus,
    address: '',
    homeowner_name: '',
    phone: '',
    email: '',
    notes: '',
  });
  const [userLocation, setUserLocation] = useState<[number, number]>([39.8283, -98.5795]);
  const queryClient = useQueryClient();

  // Get user's location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        () => {}
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
      setIsSheetOpen(false);
      setNewPin(null);
      resetForm();
      toast.success('Pin added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add pin: ' + error.message);
    },
  });

  const updatePinMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Pin> }) => {
      const { error } = await supabase.from('rep_pins').update(updates).eq('id', id);
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
      setIsSheetOpen(false);
      setSelectedPin(null);
      toast.success('Pin deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete: ' + error.message);
    },
  });

  // Convert pin to deal mutation using secure server-side function
  const convertToDealMutation = useMutation({
    mutationFn: async (pin: Pin) => {
      const { data, error } = await supabase.rpc('create_deal_from_pin', {
        _pin_id: pin.id,
        _homeowner_phone: formData.phone || null,
        _homeowner_email: formData.email || null,
      });
      
      if (error) throw error;
      return data as string;
    },
    onSuccess: (dealId) => {
      queryClient.invalidateQueries({ queryKey: ['rep-pins'] });
      setIsSheetOpen(false);
      setSelectedPin(null);
      toast.success('Deal created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create deal: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({ status: 'lead', address: '', homeowner_name: '', phone: '', email: '', notes: '' });
  };

  const handleMapClick = async (latlng: { lat: number; lng: number }) => {
    // Show loading toast
    const loadingToast = toast.loading('Getting address...');
    
    try {
      // 1. Reverse geocoding to get address
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latlng.lat}&lon=${latlng.lng}`
      );
      const data = await response.json();
      const address = data.display_name || '';

      if (!address) {
        toast.dismiss(loadingToast);
        toast.error('Could not determine address for this location.');
        return;
      }

      // 2. Check if address already exists (across all reps)
      const { data: existingPin, error: checkError } = await supabase
        .rpc('check_address_exists', { check_address: address });

      if (checkError) {
        console.error('Error checking address:', checkError);
        // Continue anyway if check fails
      }

      if (existingPin && existingPin.length > 0 && existingPin[0].exists_already) {
        toast.dismiss(loadingToast);
        toast.error('This address already has a pin. Please contact management.', {
          duration: 5000,
        });
        return;
      }

      toast.dismiss(loadingToast);
      
      // 3. Open sheet with pre-filled address
      setNewPin({ lat: latlng.lat, lng: latlng.lng });
      setSelectedPin(null);
      setFormData({ 
        status: 'lead', 
        address: address, 
        homeowner_name: '', 
        phone: '', 
        email: '', 
        notes: '' 
      });
      setIsSheetOpen(true);
      
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Error during pin creation:', error);
      toast.error('Failed to get address. Please try again.');
    }
  };

  const handlePinClick = (pin: Pin) => {
    setSelectedPin(pin);
    setNewPin(null);
    setFormData({
      status: pin.status,
      address: pin.address || '',
      homeowner_name: pin.homeowner_name || '',
      phone: '',
      email: '',
      notes: pin.notes || '',
    });
    setIsSheetOpen(true);
  };

  const handleSave = () => {
    if (newPin) {
      createPinMutation.mutate({
        lat: newPin.lat,
        lng: newPin.lng,
        status: formData.status,
        address: formData.address,
        homeowner_name: formData.homeowner_name,
        notes: formData.notes,
      });
    } else if (selectedPin) {
      updatePinMutation.mutate({
        id: selectedPin.id,
        updates: {
          status: formData.status,
          address: formData.address || null,
          homeowner_name: formData.homeowner_name || null,
          notes: formData.notes || null,
        },
      });
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Top Toggle */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
        <div className="flex bg-card/95 backdrop-blur-sm rounded-lg border border-border shadow-lg overflow-hidden">
          <button
            onClick={() => setActiveView('map')}
            className={`px-6 py-2 text-sm font-medium transition-colors ${
              activeView === 'map' 
                ? 'bg-card text-foreground' 
                : 'bg-muted text-muted-foreground'
            }`}
          >
            Map
          </button>
          <button
            onClick={() => setActiveView('list')}
            className={`px-6 py-2 text-sm font-medium transition-colors ${
              activeView === 'list' 
                ? 'bg-card text-foreground' 
                : 'bg-muted text-muted-foreground'
            }`}
          >
            List
          </button>
        </div>
      </div>

      {activeView === 'map' ? (
        <MapContainer
          center={userLocation}
          zoom={17}
          scrollWheelZoom={true}
          zoomControl={false}
          className="flex-1 w-full"
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
          <TileLayer
            attribution=''
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
          <MapLongPressHandler onLongPress={handleMapClick} />
          <MapControls userLocation={userLocation} onToggleView={() => setActiveView('list')} />
          
          {pins?.map((pin) => (
            <Marker
              key={pin.id}
              position={[pin.latitude, pin.longitude]}
              icon={createIcon(pin.status)}
              eventHandlers={{
                click: () => handlePinClick(pin),
              }}
            />
          ))}
        </MapContainer>
      ) : (
        <div className="flex-1 pt-16 pb-20 overflow-auto">
          <div className="p-4 space-y-3">
            {pins?.map((pin) => (
              <button
                key={pin.id}
                onClick={() => {
                  handlePinClick(pin);
                  setActiveView('map');
                }}
                className="w-full p-4 bg-card rounded-lg border border-border text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      {pin.homeowner_name || 'Unknown'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {pin.address || `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`}
                    </p>
                  </div>
                  <div 
                    className="px-3 py-1 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: statusConfig[pin.status].color }}
                  >
                    {statusConfig[pin.status].label}
                  </div>
                </div>
              </button>
            ))}
            {(!pins || pins.length === 0) && (
              <div className="text-center py-12 text-muted-foreground">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No pins yet. Hold the map to add one!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl px-0">
          <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-4" />
          
          <ScrollArea className="h-full px-5 pb-20">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Address</span>
                <button className="text-sm text-primary flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  Pin Linked
                </button>
              </div>

              {/* Address Input */}
              <div className="relative">
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter address..."
                  className="pr-10 bg-muted border-0 h-12"
                />
                {formData.address && (
                  <button 
                    onClick={() => setFormData({ ...formData, address: '' })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Status Tags */}
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-2">
                  {(Object.keys(statusConfig) as PinStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => setFormData({ ...formData, status })}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors shrink-0 ${
                        formData.status === status 
                          ? 'bg-muted border-2 border-primary' 
                          : 'bg-muted border-2 border-transparent'
                      }`}
                    >
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: statusConfig[status].color }}
                      />
                      <span className="text-sm font-medium">{statusConfig[status].label}</span>
                    </button>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>


              {/* Form Fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Full Name</Label>
                  <div className="relative">
                    <Input
                      value={formData.homeowner_name}
                      onChange={(e) => setFormData({ ...formData, homeowner_name: e.target.value })}
                      placeholder="Enter name..."
                      className="pr-10 bg-muted border-0 h-12"
                    />
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">Phone Number</Label>
                  <div className="relative">
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Enter phone..."
                      className="pr-10 bg-muted border-0 h-12"
                    />
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">Email</Label>
                  <div className="relative">
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Enter email..."
                      className="pr-10 bg-muted border-0 h-12"
                    />
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">Note</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Add notes..."
                    className="bg-muted border-0 min-h-[100px] resize-none"
                  />
                </div>
              </div>

              {/* Action Buttons (only for existing pins) */}
              {selectedPin && (
                <div className="space-y-3">
                  {/* Turn into Deal Button - only show if not already a deal */}
                  {!selectedPin.deal_id && (
                    <Button
                      variant="default"
                      className="w-full h-12"
                      onClick={() => convertToDealMutation.mutate(selectedPin)}
                      disabled={convertToDealMutation.isPending}
                    >
                      <Briefcase className="w-4 h-4 mr-2" />
                      {convertToDealMutation.isPending ? 'Creating Deal...' : 'Turn into Deal'}
                    </Button>
                  )}
                  
                  {/* Already a deal badge */}
                  {selectedPin.deal_id && (
                    <div className="flex items-center justify-center gap-2 py-3 px-4 bg-primary/10 rounded-lg text-primary">
                      <Briefcase className="w-4 h-4" />
                      <span className="font-medium">Already a Deal</span>
                    </div>
                  )}
                  
                  <Button
                    variant="ghost"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deletePinMutation.mutate(selectedPin.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Pin
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Save Button - Fixed at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
            <Button 
              onClick={handleSave}
              disabled={createPinMutation.isPending || updatePinMutation.isPending}
              className="w-full h-12 bg-primary text-primary-foreground font-semibold rounded-full"
            >
              {createPinMutation.isPending || updatePinMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
