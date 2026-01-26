import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { pinsApi, repsApi, Pin as AwsPin, Rep } from '@/integrations/aws/api';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Loader2, MapPin, Search, Users, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const MAPBOX_TOKEN_ENV = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

type PinStatus = 'lead' | 'followup' | 'installed' | 'appointment' | 'renter' | 'not_interested';

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
  appointment_date: string | null;
  rep_id: string;
  rep_name?: string;
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
    notes: awsPin.notes,
    created_at: awsPin.created_at,
    deal_id: awsPin.deal_id,
    appointment_date: awsPin.appointment_date,
    rep_id: awsPin.rep_id,
    rep_name: awsPin.rep_name,
  };
}

interface RepProfile {
  id: string;
  user_id: string;
  full_name: string | null;
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

export default function AdminMap() {
  const queryClient = useQueryClient();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map());

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string | undefined>(MAPBOX_TOKEN_ENV);
  const [selectedRep, setSelectedRep] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<PinStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [reassignSheetOpen, setReassignSheetOpen] = useState(false);
  const [newRepId, setNewRepId] = useState<string>('');

  // Mapbox token from env
  useEffect(() => {
    if (!mapboxToken) {
      console.log('Mapbox token not found, please set VITE_MAPBOX_ACCESS_TOKEN');
    }
  }, [mapboxToken]);

  // Fetch all pins (admin has access to all pins via AWS API)
  const { data: pins, isLoading: pinsLoading } = useQuery({
    queryKey: ['admin-all-pins'],
    queryFn: async () => {
      const response = await pinsApi.list();
      if (response.error) throw new Error(response.error);
      return (response.data || []).map(mapAwsPinToPin);
    },
  });

  // Fetch reps with profiles for filtering
  const { data: reps } = useQuery({
    queryKey: ['admin-reps-profiles'],
    queryFn: async () => {
      const response = await repsApi.list();
      if (response.error) throw new Error(response.error);
      return (response.data || []).map(rep => ({
        id: rep.id,
        user_id: rep.user_id,
        full_name: rep.full_name,
        email: rep.email,
      })) as RepProfile[];
    },
  });

  // Build rep lookup
  const repLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    reps?.forEach(rep => {
      const name = rep.full_name || rep.email || 'Unknown Rep';
      lookup[rep.id] = name;
    });
    return lookup;
  }, [reps]);

  // Reassign pin mutation
  const reassignPinMutation = useMutation({
    mutationFn: async ({ pinId, repId }: { pinId: string; repId: string }) => {
      const response = await pinsApi.update(pinId, { rep_id: repId });
      if (response.error) throw new Error(response.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-pins'] });
      toast.success('Pin reassigned successfully');
      setReassignSheetOpen(false);
      setSelectedPin(null);
      setNewRepId('');
    },
    onError: (error) => {
      toast.error('Failed to reassign pin: ' + error.message);
    },
  });

  const handleReassign = () => {
    if (!selectedPin || !newRepId) return;
    reassignPinMutation.mutate({ pinId: selectedPin.id, repId: newRepId });
  };

  // Filter pins
  const filteredPins = useMemo(() => {
    if (!pins) return [];
    return pins.filter(pin => {
      if (selectedRep !== 'all' && pin.rep_id !== selectedRep) return false;
      if (statusFilter !== 'all' && pin.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = pin.homeowner_name?.toLowerCase().includes(query);
        const matchesAddress = pin.address?.toLowerCase().includes(query);
        if (!matchesName && !matchesAddress) return false;
      }
      return true;
    });
  }, [pins, selectedRep, statusFilter, searchQuery]);

  // Pin stats
  const pinStats = useMemo(() => {
    if (!pins) return { total: 0, lead: 0, followup: 0, appointment: 0, installed: 0 };
    return {
      total: pins.length,
      lead: pins.filter(p => p.status === 'lead').length,
      followup: pins.filter(p => p.status === 'followup').length,
      appointment: pins.filter(p => p.status === 'appointment').length,
      installed: pins.filter(p => p.status === 'installed').length,
    };
  }, [pins]);

  // Initialize Mapbox
  useEffect(() => {
    if (!mapboxToken) return;
    if (!mapContainer.current) return;
    if (map.current) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-98.5795, 39.8283], // Center of US
      zoom: 4,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        setMapLoaded(false);
      }
    };
  }, [mapboxToken]);

  // Update markers when filtered pins change
  useEffect(() => {
    if (!map.current || !mapLoaded || !filteredPins) return;

    markers.current.forEach((marker) => marker.remove());
    markers.current.clear();

    filteredPins.forEach((pin) => {
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.innerHTML = `
        <div style="
          background-color: ${statusConfig[pin.status]?.color || '#888'};
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        ">
          <div style="
            width: 10px;
            height: 10px;
            background: white;
            border-radius: 50%;
            opacity: 0.9;
          "></div>
        </div>
      `;

      el.addEventListener('click', () => {
        setSelectedPin(pin);
        map.current?.flyTo({ center: [pin.longitude, pin.latitude], zoom: 17 });
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([pin.longitude, pin.latitude])
        .addTo(map.current!);

      markers.current.set(pin.id, marker);
    });

    // Fit bounds to all pins if there are any
    if (filteredPins.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      filteredPins.forEach(pin => {
        bounds.extend([pin.longitude, pin.latitude]);
      });
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    }
  }, [filteredPins, mapLoaded]);

  return (
    <AdminLayout title="Rep Pins Map">
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-12rem)]">
        {/* Sidebar */}
        <div className="w-full lg:w-80 space-y-4 flex-shrink-0">
          {/* Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Pin Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <div className="text-center p-2 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{pinStats.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center p-2 rounded-lg" style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)' }}>
                <div className="text-2xl font-bold" style={{ color: '#a855f7' }}>{pinStats.lead}</div>
                <div className="text-xs text-muted-foreground">Not Home</div>
              </div>
              <div className="text-center p-2 rounded-lg" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
                <div className="text-2xl font-bold" style={{ color: '#f59e0b' }}>{pinStats.appointment}</div>
                <div className="text-xs text-muted-foreground">Appointments</div>
              </div>
              <div className="text-center p-2 rounded-lg" style={{ backgroundColor: 'rgba(20, 184, 166, 0.1)' }}>
                <div className="text-2xl font-bold" style={{ color: '#14b8a6' }}>{pinStats.installed}</div>
                <div className="text-xs text-muted-foreground">Installed</div>
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search pins..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={selectedRep} onValueChange={setSelectedRep}>
                <SelectTrigger>
                  <Users className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="All Reps" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reps</SelectItem>
                  {reps?.map(rep => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.full_name || rep.email || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PinStatus | 'all')}>
                <SelectTrigger>
                  <MapPin className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(statusConfig).map(([status, config]) => (
                    <SelectItem key={status} value={status}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: config.color }}
                        />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Pin List */}
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Pins ({filteredPins.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-64">
                {pinsLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredPins.length === 0 ? (
                  <div className="text-center p-4 text-muted-foreground text-sm">
                    No pins found
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredPins.slice(0, 50).map(pin => (
                      <button
                        key={pin.id}
                        className={cn(
                          'w-full text-left p-3 hover:bg-muted transition-colors',
                          selectedPin?.id === pin.id && 'bg-primary/10'
                        )}
                        onClick={() => {
                          setSelectedPin(pin);
                          map.current?.flyTo({ center: [pin.longitude, pin.latitude], zoom: 17 });
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                            style={{ backgroundColor: statusConfig[pin.status]?.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {pin.homeowner_name || 'Unknown'}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {pin.address || 'No address'}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Rep: {repLookup[pin.rep_id] || 'Unknown'}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] flex-shrink-0">
                            {statusConfig[pin.status]?.label}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Map */}
        <Card className="flex-1 overflow-hidden">
          <div ref={mapContainer} className="w-full h-full min-h-[400px]" />
          {!mapboxToken && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="text-center text-muted-foreground">
                <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Loading map...</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Selected Pin Detail */}
      {selectedPin && (
        <Card className="fixed bottom-4 right-4 w-80 z-50 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Pin Details</CardTitle>
              <button
                onClick={() => setSelectedPin(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Homeowner:</span>{' '}
              <span className="font-medium">{selectedPin.homeowner_name || 'Unknown'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Address:</span>{' '}
              <span>{selectedPin.address || 'No address'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>{' '}
              <Badge
                variant="outline"
                style={{ borderColor: statusConfig[selectedPin.status]?.color, color: statusConfig[selectedPin.status]?.color }}
              >
                {statusConfig[selectedPin.status]?.label}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Rep:</span>{' '}
              <span>{repLookup[selectedPin.rep_id] || 'Unknown'}</span>
            </div>
            {selectedPin.notes && (
              <div>
                <span className="text-muted-foreground">Notes:</span>{' '}
                <span className="text-xs">{selectedPin.notes}</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              onClick={() => {
                setNewRepId(selectedPin.rep_id);
                setReassignSheetOpen(true);
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reassign to Another Rep
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Reassign Sheet */}
      <Sheet open={reassignSheetOpen} onOpenChange={setReassignSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Reassign Pin</SheetTitle>
            <SheetDescription>
              Transfer this pin to a different sales representative.
            </SheetDescription>
          </SheetHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label>Current Rep</Label>
              <div className="p-3 bg-muted rounded-lg text-sm">
                {selectedPin ? repLookup[selectedPin.rep_id] || 'Unknown' : '-'}
              </div>
            </div>
            <div className="space-y-2">
              <Label>New Rep</Label>
              <Select value={newRepId} onValueChange={setNewRepId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a rep..." />
                </SelectTrigger>
                <SelectContent>
                  {reps?.filter(rep => rep.id !== selectedPin?.rep_id).map(rep => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.full_name || rep.email || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedPin && (
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <div className="font-medium">{selectedPin.homeowner_name || 'Unknown'}</div>
                <div className="text-muted-foreground">{selectedPin.address || 'No address'}</div>
              </div>
            )}
          </div>
          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => setReassignSheetOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReassign}
              disabled={!newRepId || newRepId === selectedPin?.rep_id || reassignPinMutation.isPending}
            >
              {reassignPinMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Reassigning...
                </>
              ) : (
                'Reassign Pin'
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
