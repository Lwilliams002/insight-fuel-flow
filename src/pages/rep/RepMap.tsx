import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { 
  MapPin, Crosshair, X, User, Phone, Mail, Trash2, Briefcase, 
  CalendarIcon, Clock, Filter, ChevronDown
} from 'lucide-react';

const MAPBOX_TOKEN_ENV = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

type PinStatus = 'lead' | 'followup' | 'installed' | 'appointment';

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
}

const statusConfig: Record<PinStatus, { color: string; label: string }> = {
  lead: { color: '#a855f7', label: 'Not Home' },
  followup: { color: '#ec4899', label: 'Needs Follow-up' },
  installed: { color: '#14b8a6', label: 'Installed' },
  appointment: { color: '#f59e0b', label: 'Appointment' },
};

interface NewPinData {
  lat: number;
  lng: number;
}

export default function RepMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressCoords = useRef<{ lng: number; lat: number } | null>(null);

  const [activeView, setActiveView] = useState<'map' | 'list' | 'calendar'>('map');
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
    appointment_date: undefined as Date | undefined,
    appointment_time: '',
  });
  const [userLocation, setUserLocation] = useState<[number, number]>([39.8283, -98.5795]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string | undefined>(MAPBOX_TOKEN_ENV);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<PinStatus | 'all'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  // Calendar
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | undefined>(undefined);
  
  const queryClient = useQueryClient();

  // Fallback: fetch token from backend if env var isn't present
  useEffect(() => {
    if (mapboxToken) return;
    let cancelled = false;

    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) return;

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mapbox-token`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load token');
        if (!cancelled) setMapboxToken(json.token);
      } catch (e) {
        console.error('Failed to fetch Mapbox token:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mapboxToken]);

  // Get user's location with live updates
  useEffect(() => {
    if (!navigator.geolocation) return;

    let watchId: number;
    let initialFlyDone = false;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLoc: [number, number] = [position.coords.latitude, position.coords.longitude];
        setUserLocation(newLoc);
        if (map.current && !initialFlyDone) {
          map.current.flyTo({ center: [newLoc[1], newLoc[0]], zoom: 17 });
          initialFlyDone = true;
        }
      },
      () => {}
    );

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLoc: [number, number] = [position.coords.latitude, position.coords.longitude];
        setUserLocation(newLoc);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Initialize Mapbox
  useEffect(() => {
    if (!mapboxToken) return;
    if (!mapContainer.current) return;
    if (map.current) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [userLocation[1], userLocation[0]],
      zoom: 17,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    const handleTouchStart = (e: mapboxgl.MapTouchEvent) => {
      if (e.originalEvent.touches.length !== 1) return;
      longPressCoords.current = e.lngLat;
      longPressTimer.current = setTimeout(() => {
        if (longPressCoords.current) {
          handleMapLongPress(longPressCoords.current.lat, longPressCoords.current.lng);
        }
      }, 600);
    };

    const handleTouchEnd = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };

    const handleTouchMove = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };

    const handleMouseDown = (e: mapboxgl.MapMouseEvent) => {
      longPressCoords.current = e.lngLat;
      longPressTimer.current = setTimeout(() => {
        if (longPressCoords.current) {
          handleMapLongPress(longPressCoords.current.lat, longPressCoords.current.lng);
        }
      }, 600);
    };

    const handleMouseUp = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };

    const handleMouseMove = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };

    map.current.on('touchstart', handleTouchStart);
    map.current.on('touchend', handleTouchEnd);
    map.current.on('touchmove', handleTouchMove);
    map.current.on('mousedown', handleMouseDown);
    map.current.on('mouseup', handleMouseUp);
    map.current.on('mousemove', handleMouseMove);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        setMapLoaded(false);
      }
    };
  }, [mapboxToken]);

  // Force map resize when switching back to map view
  useEffect(() => {
    if (activeView === 'map' && map.current) {
      setTimeout(() => {
        map.current?.resize();
      }, 100);
    }
  }, [activeView]);

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

  // Filtered pins for list view
  const filteredPins = useMemo(() => {
    if (!pins) return [];
    if (statusFilter === 'all') return pins;
    return pins.filter(pin => pin.status === statusFilter);
  }, [pins, statusFilter]);

  // Appointments for calendar
  const appointmentPins = useMemo(() => {
    if (!pins) return [];
    return pins.filter(pin => pin.status === 'appointment' && pin.appointment_date);
  }, [pins]);

  // Appointments for selected calendar date
  const selectedDateAppointments = useMemo(() => {
    if (!selectedCalendarDate || !appointmentPins) return [];
    return appointmentPins.filter(pin => 
      pin.appointment_date && isSameDay(new Date(pin.appointment_date), selectedCalendarDate)
    );
  }, [selectedCalendarDate, appointmentPins]);

  // Days with appointments for calendar highlighting
  const daysWithAppointments = useMemo(() => {
    if (!appointmentPins) return new Set<string>();
    const days = new Set<string>();
    appointmentPins.forEach(pin => {
      if (pin.appointment_date) {
        days.add(format(new Date(pin.appointment_date), 'yyyy-MM-dd'));
      }
    });
    return days;
  }, [appointmentPins]);

  // Update user location marker
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (!userMarker.current) {
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      el.innerHTML = `
        <div style="position: relative; width: 24px; height: 24px;">
          <div style="
            position: absolute;
            top: 0; left: 0;
            width: 24px;
            height: 24px;
            background: rgba(59, 130, 246, 0.3);
            border-radius: 50%;
            animation: pulse 2s ease-out infinite;
          "></div>
          <div style="
            position: absolute;
            top: 6px; left: 6px;
            width: 12px;
            height: 12px;
            background: #3b82f6;
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          "></div>
        </div>
        <style>
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            100% { transform: scale(2.5); opacity: 0; }
          }
        </style>
      `;

      userMarker.current = new mapboxgl.Marker({ element: el })
        .setLngLat([userLocation[1], userLocation[0]])
        .addTo(map.current);
    } else {
      userMarker.current.setLngLat([userLocation[1], userLocation[0]]);
    }
  }, [userLocation, mapLoaded]);

  // Update markers when pins change
  useEffect(() => {
    if (!map.current || !mapLoaded || !pins) return;

    markers.current.forEach((marker) => marker.remove());
    markers.current.clear();

    pins.forEach((pin) => {
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

      el.addEventListener('click', () => handlePinClick(pin));

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([pin.longitude, pin.latitude])
        .addTo(map.current!);

      markers.current.set(pin.id, marker);
    });
  }, [pins, mapLoaded]);

  const createPinMutation = useMutation({
    mutationFn: async (data: { 
      lat: number; 
      lng: number; 
      status: PinStatus; 
      address: string; 
      homeowner_name: string; 
      notes: string;
      appointment_date: string | null;
    }) => {
      const { error } = await supabase.from('rep_pins').insert({
        rep_id: repData,
        latitude: data.lat,
        longitude: data.lng,
        status: data.status,
        address: data.address || null,
        homeowner_name: data.homeowner_name || null,
        notes: data.notes || null,
        appointment_date: data.appointment_date,
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
      setIsSheetOpen(false);
      setSelectedPin(null);
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
    onSuccess: () => {
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
    setFormData({ 
      status: 'lead', 
      address: '', 
      homeowner_name: '', 
      phone: '', 
      email: '', 
      notes: '',
      appointment_date: undefined,
      appointment_time: '',
    });
  };

  const handleMapLongPress = async (lat: number, lng: number) => {
    if (!mapboxToken) {
      toast.error('Map token missing. Please set a public Mapbox token (pk.*).');
      return;
    }
    const loadingToast = toast.loading('Getting address...');

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}`
      );
      const data = await response.json();
      const address = data.features?.[0]?.place_name || '';

      if (!address) {
        toast.dismiss(loadingToast);
        toast.error('Could not determine address for this location.');
        return;
      }

      const { data: existingPin, error: checkError } = await supabase
        .rpc('check_address_exists', { check_address: address });

      if (checkError) {
        console.error('Error checking address:', checkError);
      }

      if (existingPin && existingPin.length > 0 && existingPin[0].exists_already) {
        toast.dismiss(loadingToast);
        toast.error('This address already has a pin. Please contact management.', { duration: 5000 });
        return;
      }

      toast.dismiss(loadingToast);

      setNewPin({ lat, lng });
      setSelectedPin(null);
      setFormData({
        status: 'lead',
        address: address,
        homeowner_name: '',
        phone: '',
        email: '',
        notes: '',
        appointment_date: undefined,
        appointment_time: '',
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
      appointment_date: pin.appointment_date ? new Date(pin.appointment_date) : undefined,
      appointment_time: pin.appointment_date ? format(new Date(pin.appointment_date), 'HH:mm') : '',
    });
    setIsSheetOpen(true);
  };

  const getAppointmentDateTime = (): string | null => {
    if (formData.status !== 'appointment' || !formData.appointment_date) return null;
    
    const date = formData.appointment_date;
    const time = formData.appointment_time || '09:00';
    const [hours, minutes] = time.split(':').map(Number);
    
    const dateTime = new Date(date);
    dateTime.setHours(hours, minutes, 0, 0);
    
    return dateTime.toISOString();
  };

  const handleSave = () => {
    const appointmentDateTime = getAppointmentDateTime();
    
    if (newPin) {
      createPinMutation.mutate({
        lat: newPin.lat,
        lng: newPin.lng,
        status: formData.status,
        address: formData.address,
        homeowner_name: formData.homeowner_name,
        notes: formData.notes,
        appointment_date: appointmentDateTime,
      });
    } else if (selectedPin) {
      updatePinMutation.mutate({
        id: selectedPin.id,
        updates: {
          status: formData.status,
          address: formData.address || null,
          homeowner_name: formData.homeowner_name || null,
          notes: formData.notes || null,
          appointment_date: appointmentDateTime,
        },
      });
    }
  };

  const handleLocate = () => {
    if (map.current) {
      map.current.flyTo({ center: [userLocation[1], userLocation[0]], zoom: 17 });
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <main className="relative flex-1 overflow-hidden">
        {/* Top Toggle - 3 tabs */}
        <div className="absolute left-1/2 -translate-x-1/2 z-[1000]" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
          <div className="flex bg-card/95 backdrop-blur-sm rounded-lg border border-border shadow-lg overflow-hidden">
            <button
              onClick={() => setActiveView('map')}
              className={`px-5 py-2 text-sm font-medium transition-colors ${
                activeView === 'map'
                  ? 'bg-card text-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              Map
            </button>
            <button
              onClick={() => setActiveView('list')}
              className={`px-5 py-2 text-sm font-medium transition-colors ${
                activeView === 'list'
                  ? 'bg-card text-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setActiveView('calendar')}
              className={`px-5 py-2 text-sm font-medium transition-colors ${
                activeView === 'calendar'
                  ? 'bg-card text-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              Calendar
            </button>
          </div>
        </div>

        {/* Map View */}
        <div className={`${activeView === 'map' ? 'block' : 'hidden'}`}>
          {!mapboxToken ? (
            <div className="absolute inset-0 flex items-center justify-center p-6" style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}>
              <div className="max-w-md w-full bg-card border border-border rounded-xl p-5 space-y-3">
                <div className="font-semibold text-foreground">Mapbox token missing</div>
                <div className="text-sm text-muted-foreground">
                  Add a <span className="font-medium">public</span> Mapbox token (starts with <span className="font-mono">pk.</span>)
                  as <span className="font-mono">VITE_MAPBOX_ACCESS_TOKEN</span>.
                </div>
              </div>
            </div>
          ) : (
            <div ref={mapContainer} className="absolute inset-0" style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }} />
          )}
          
          {/* Location Follow Button */}
          <div className="absolute right-3 z-[1000]" style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
            <button
              onClick={handleLocate}
              className="w-11 h-11 rounded-full bg-card/95 backdrop-blur-sm border border-border shadow-lg flex items-center justify-center text-foreground hover:bg-muted transition-colors"
              title="My Location"
            >
              <Crosshair className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* List View */}
        <div
          className={`absolute inset-0 pt-16 overflow-auto ${activeView === 'list' ? 'block' : 'hidden'}`}
          style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
        >
          {/* Filter Bar */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-3 border-b border-border">
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg text-sm font-medium"
              >
                <Filter className="w-4 h-4" />
                {statusFilter === 'all' ? 'All Pins' : statusConfig[statusFilter].label}
                <ChevronDown className="w-4 h-4" />
              </button>
              
              {showFilterDropdown && (
                <div className="absolute top-full left-0 mt-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-20">
                  <button
                    onClick={() => { setStatusFilter('all'); setShowFilterDropdown(false); }}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors ${statusFilter === 'all' ? 'bg-muted' : ''}`}
                  >
                    All Pins
                  </button>
                  {(Object.keys(statusConfig) as PinStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => { setStatusFilter(status); setShowFilterDropdown(false); }}
                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2 ${statusFilter === status ? 'bg-muted' : ''}`}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: statusConfig[status].color }} />
                      {statusConfig[status].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 space-y-3">
            {filteredPins?.map((pin) => (
              <button
                key={pin.id}
                onClick={() => handlePinClick(pin)}
                className="w-full p-4 bg-card rounded-lg border border-border text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {pin.homeowner_name || 'Unknown'}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {pin.address || `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`}
                    </p>
                    {pin.status === 'appointment' && pin.appointment_date && (
                      <p className="text-xs text-amber-500 flex items-center gap-1 mt-1">
                        <CalendarIcon className="w-3 h-3" />
                        {format(new Date(pin.appointment_date), 'MMM d, yyyy h:mm a')}
                      </p>
                    )}
                  </div>
                  <div
                    className="px-3 py-1 rounded-full text-xs font-medium text-white shrink-0 ml-2"
                    style={{ backgroundColor: statusConfig[pin.status]?.color || '#888' }}
                  >
                    {statusConfig[pin.status]?.label || pin.status}
                  </div>
                </div>
              </button>
            ))}
            {(!filteredPins || filteredPins.length === 0) && (
              <div className="text-center py-12 text-muted-foreground">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{statusFilter === 'all' ? 'No pins yet. Hold the map to add one!' : 'No pins with this status.'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Calendar View */}
        <div
          className={`absolute inset-0 pt-16 overflow-auto ${activeView === 'calendar' ? 'block' : 'hidden'}`}
          style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="p-4">
            {/* Calendar */}
            <div className="bg-card rounded-xl border border-border p-4">
              <Calendar
                mode="single"
                selected={selectedCalendarDate}
                onSelect={setSelectedCalendarDate}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                className="pointer-events-auto"
                modifiers={{
                  hasAppointment: (date) => daysWithAppointments.has(format(date, 'yyyy-MM-dd'))
                }}
                modifiersStyles={{
                  hasAppointment: {
                    backgroundColor: 'hsl(var(--primary) / 0.2)',
                    borderRadius: '50%',
                  }
                }}
              />
            </div>

            {/* Selected Date Appointments */}
            <div className="mt-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {selectedCalendarDate 
                  ? format(selectedCalendarDate, 'EEEE, MMMM d, yyyy')
                  : 'Select a date to see appointments'}
              </h3>
              
              {selectedCalendarDate && selectedDateAppointments.length > 0 ? (
                <div className="space-y-3">
                  {selectedDateAppointments.map((pin) => (
                    <button
                      key={pin.id}
                      onClick={() => handlePinClick(pin)}
                      className="w-full p-4 bg-card rounded-lg border border-border text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                          <Clock className="w-5 h-5 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {pin.homeowner_name || 'Unknown'}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {pin.address}
                          </p>
                          <p className="text-sm text-amber-500 mt-1">
                            {pin.appointment_date && format(new Date(pin.appointment_date), 'h:mm a')}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : selectedCalendarDate ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No appointments on this day</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Bottom Sheet */}
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetContent 
            side="bottom" 
            className="h-[92vh] rounded-t-3xl px-0 flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Drag Handle */}
            <div className="flex-shrink-0 pt-3 pb-2">
              <div className="w-12 h-1.5 bg-muted rounded-full mx-auto" />
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-5">
              <div className="space-y-5 pb-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Address</span>
                  <span className="text-sm text-primary flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    Pin Linked
                  </span>
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
                  <div className="flex gap-2 pb-1">
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

                {/* Appointment Date/Time - Only show when appointment status is selected */}
                {formData.status === 'appointment' && (
                  <div className="space-y-4 p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <div className="flex items-center gap-2 text-amber-600">
                      <CalendarIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">Schedule Appointment</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs">Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal h-11 bg-muted border-0",
                                !formData.appointment_date && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.appointment_date ? format(formData.appointment_date, "MMM d") : "Pick date"}
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
                      
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs">Time</Label>
                        <div className="relative">
                          <Input
                            type="time"
                            value={formData.appointment_time}
                            onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
                            className="bg-muted border-0 h-11"
                          />
                          <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Form Fields */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Full Name</Label>
                    <div className="relative">
                      <Input
                        value={formData.homeowner_name}
                        onChange={(e) => setFormData({ ...formData, homeowner_name: e.target.value })}
                        placeholder=""
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
                        placeholder=""
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
                        placeholder=""
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
                      placeholder=""
                      className="bg-muted border-0 min-h-[100px] resize-none"
                    />
                  </div>
                </div>

                {/* Action Buttons (only for existing pins) */}
                {selectedPin && (
                  <div className="space-y-3">
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
            </div>

            {/* Save Button - Fixed at bottom */}
            <div 
              className="flex-shrink-0 p-4 bg-background border-t border-border"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
            >
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
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
