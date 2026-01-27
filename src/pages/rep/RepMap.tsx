import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { pinsApi, Pin as AwsPin } from "@/integrations/aws/api";
import { useAuth } from "@/contexts/AwsAuthContext";
import { BottomNav } from "@/components/BottomNav";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, isToday, startOfWeek, endOfWeek } from "date-fns";
import {
  MapPin,
  Crosshair,
  X,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Navigation,
  Plus,
  Users,
  Clock,
  CheckCircle,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const MAPBOX_TOKEN_ENV = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

type PinStatus = "lead" | "followup" | "installed" | "appointment" | "renter" | "not_interested";

// Map AWS Pin to local Pin format for compatibility
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
  appointment_end_date: string | null;
  appointment_all_day: boolean | null;
  assigned_closer_id: string | null;
  rep_id: string;
}

// Convert AWS Pin to local Pin format
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
    appointment_end_date: awsPin.appointment_end_date,
    appointment_all_day: awsPin.appointment_all_day,
    assigned_closer_id: awsPin.assigned_closer_id,
    rep_id: awsPin.rep_id,
  };
}

const statusConfig: Record<PinStatus, { color: string; label: string }> = {
  lead: { color: "#4A6FA5", label: "Not Home" },           // Prime Steel Blue
  followup: { color: "#C9A24D", label: "Needs Follow-up" }, // Prime Gold
  installed: { color: "#2E7D32", label: "Installed" },      // Professional Green
  appointment: { color: "#C9A24D", label: "Appointment" },  // Prime Gold
  renter: { color: "#78909C", label: "Renter" },            // Gray Blue
  not_interested: { color: "#B71C1C", label: "Not Interested" }, // Dark Red
};


export default function RepMap() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, getIdToken } = useAuth();
  const queryClient = useQueryClient();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressCoords = useRef<{ lng: number; lat: number } | null>(null);
  const mapboxglRef = useRef<typeof mapboxgl | null>(null);

  // Read initial tab from URL
  const initialTab = searchParams.get("tab") as "map" | "list" | null;
  const [activeView, setActiveView] = useState<"map" | "list">(initialTab || "map");
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationObtained, setLocationObtained] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapboxReady, setMapboxReady] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<PinStatus | "all">("all");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Follow mode - automatically center map on user location
  const [isFollowing, setIsFollowing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Add pin dialog
  const [isAddPinOpen, setIsAddPinOpen] = useState(false);
  const [pinForm, setPinForm] = useState({
    status: 'lead' as PinStatus,
    homeowner_name: '',
    address: '',
    notes: '',
    appointment_date: '',
    appointment_time: '',
  });
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  // Dynamically load mapbox-gl only when needed (on map view)
  useEffect(() => {
    if (activeView !== "map" || mapboxReady) return;

    let cancelled = false;

    import("mapbox-gl").then((module) => {
      if (!cancelled) {
        mapboxglRef.current = module.default;
        setMapboxReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeView, mapboxReady]);

  // Get user's location with live updates
  useEffect(() => {
    if (!navigator.geolocation) {
      // Fallback to default location if geolocation not available
      setUserLocation([39.8283, -98.5795]);
      setLocationObtained(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLoc: [number, number] = [position.coords.latitude, position.coords.longitude];
        setUserLocation(newLoc);
        setLocationObtained(true);
      },
      () => {
        // Error getting location - use default
        setUserLocation([39.8283, -98.5795]);
        setLocationObtained(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLoc: [number, number] = [position.coords.latitude, position.coords.longitude];
        setUserLocation(newLoc);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const handleLocate = () => {
    setIsFollowing((prev) => !prev);
    if (map.current && userLocation) {
      map.current.flyTo({ center: [userLocation[1], userLocation[0]], zoom: 17 });
    }
  };

  const handleMapLongPress = (lat: number, lng: number) => {
    console.log("handleMapLongPress called with:", lat, lng);
    // Reverse geocode to get address from coordinates
    if (!MAPBOX_TOKEN_ENV) {
      console.log("No Mapbox token available");
      return;
    }

    fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN_ENV}`)
      .then(response => response.json())
      .then(data => {
        console.log("Geocoding response:", data);
        const address = data.features?.[0]?.place_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        console.log("Setting address to:", address);
        setPinForm(prev => ({
          ...prev,
          address,
        }));
        console.log("Opening appointment dialog");
        setIsAddPinOpen(true);
      })
      .catch(error => {
        console.error("Error reverse geocoding:", error);
        // Fallback to coordinates if geocoding fails
        const fallbackAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        console.log("Using fallback address:", fallbackAddress);
        setPinForm(prev => ({
          ...prev,
          address: fallbackAddress,
        }));
        console.log("Opening appointment dialog (fallback)");
        setIsAddPinOpen(true);
      });
  };

  const handlePinClick = useCallback((pin: Pin) => {
    // Navigate to pin detail/edit page
    navigate(`/map/pin/${pin.id}`);
  }, [navigate]);

  // Initialize Mapbox - only runs once when location is first obtained
  useEffect(() => {
    if (!mapboxReady || !mapboxglRef.current) return;
    if (!mapContainer.current) return;
    if (map.current) return; // Already initialized
    if (!locationObtained || !userLocation) return; // Wait for location

    const mapboxgl = mapboxglRef.current;
    mapboxgl.accessToken = MAPBOX_TOKEN_ENV;

    // Use current userLocation value for initial center
    const initialCenter: [number, number] = [userLocation[1], userLocation[0]];

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: initialCenter,
      zoom: 17,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    const handleTouchStart = (e: mapboxgl.MapTouchEvent) => {
      console.log("Touch start detected");
      if (e.originalEvent.touches.length !== 1) return;
      longPressCoords.current = e.lngLat;
      longPressTimer.current = setTimeout(() => {
        console.log("Long press timer fired");
        if (longPressCoords.current) {
          handleMapLongPress(longPressCoords.current.lat, longPressCoords.current.lng);
        }
      }, 600);
    };

    const handleTouchEnd = () => {
      console.log("Touch end detected");
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };

    const handleTouchMove = () => {
      console.log("Touch move detected");
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };

    const handleMouseDown = (e: mapboxgl.MapMouseEvent) => {
      console.log("Mouse down detected");
      longPressCoords.current = e.lngLat;
      longPressTimer.current = setTimeout(() => {
        console.log("Long press timer fired (mouse)");
        if (longPressCoords.current) {
          handleMapLongPress(longPressCoords.current.lat, longPressCoords.current.lng);
        }
      }, 600);
    };

    const handleMouseUp = () => {
      console.log("Mouse up detected");
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };

    const handleMouseMove = () => {
      console.log("Mouse move detected");
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };

    map.current.on("touchstart", handleTouchStart);
    map.current.on("touchend", handleTouchEnd);
    map.current.on("touchmove", handleTouchMove);
    map.current.on("mousedown", handleMouseDown);
    map.current.on("mouseup", handleMouseUp);
    map.current.on("mousemove", handleMouseMove);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        setMapLoaded(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxReady, locationObtained]); // Don't include userLocation to prevent re-init on location updates

  // Force map resize when switching back to map view
  useEffect(() => {
    if (activeView === "map" && map.current) {
      setTimeout(() => {
        map.current?.resize();
      }, 100);
    }
  }, [activeView]);

  // Fetch rep's pins from AWS
  const { data: pins } = useQuery({
    queryKey: ["rep-pins"],
    queryFn: async () => {
      const response = await pinsApi.list();
      if (response.error) throw new Error(response.error);
      // Map AWS pins to local format
      return (response.data || []).map(mapAwsPinToPin);
    },
    staleTime: 30000, // 30 seconds - prevents refetch on every mount
  });

  // Get current user's rep_id from auth context
  const currentRepId = user?.sub;

  // Fetch appointments where current rep is assigned as closer (separate from own pins)
  const { data: closerAppointments } = useQuery({
    queryKey: ["closer-appointments", currentRepId],
    queryFn: async () => {
      if (!currentRepId) return [];
      // Fetch all pins and filter for appointments where current user is assigned as closer
      const response = await pinsApi.list();
      if (response.error) {
        console.log("Closer appointments query error:", response.error);
        return [];
      }
      return (response.data || [])
        .filter(pin => pin.assigned_closer_id === currentRepId && pin.status === "appointment")
        .map(mapAwsPinToPin)
        .sort((a, b) => {
          if (!a.appointment_date || !b.appointment_date) return 0;
          return new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime();
        });
    },
    enabled: !!currentRepId,
    staleTime: 30000, // 30 seconds
  });

  // Dashboard stats
  const stats = useMemo(() => {
    const totalLeads = pins?.length || 0;
    const todayAppts = closerAppointments?.filter(pin => pin.appointment_date && isToday(new Date(pin.appointment_date))).length || 0;
    const thisWeekAppts = closerAppointments?.filter(pin => {
      if (!pin.appointment_date) return false;
      const apptDate = new Date(pin.appointment_date);
      const weekStart = startOfWeek(new Date());
      const weekEnd = endOfWeek(new Date());
      return apptDate >= weekStart && apptDate <= weekEnd;
    }).length || 0;
    const installedCount = pins?.filter(pin => pin.status === 'installed').length || 0;
    return { totalLeads, todayAppts, thisWeekAppts, installedCount };
  }, [pins, closerAppointments]);

  // Render pins as markers on the map
  useEffect(() => {
    if (!map.current || !mapLoaded || !pins || !mapboxglRef.current) return;

    const mapboxgl = mapboxglRef.current;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current.clear();

    // Add markers for each pin
    pins.forEach(pin => {
      if (pin.latitude && pin.longitude) {
        const markerElement = document.createElement('div');
        markerElement.className = 'w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center';
        markerElement.style.backgroundColor = statusConfig[pin.status]?.color || '#888';

        const marker = new mapboxgl.Marker(markerElement)
          .setLngLat([pin.longitude, pin.latitude])
          .addTo(map.current!);

        // Add click handler
        marker.getElement().addEventListener('click', () => {
          handlePinClick(pin);
        });

        markers.current.set(pin.id, marker);
      }
    });

    // Add user location marker if available
    if (userLocation && userMarker.current) {
      userMarker.current.remove();
    }
    if (userLocation) {
      const userMarkerElement = document.createElement('div');
      userMarkerElement.className = 'w-4 h-4 rounded-full border-2 border-white shadow-lg';
      userMarkerElement.style.backgroundColor = "#C9A24D"; // Prime Gold color

      userMarker.current = new mapboxgl.Marker(userMarkerElement)
        .setLngLat([userLocation[1], userLocation[0]])
        .addTo(map.current!);
    }

    return () => {
      // Cleanup markers when component unmounts or pins change
      markers.current.forEach(marker => marker.remove());
      markers.current.clear();
      if (userMarker.current) {
        userMarker.current.remove();
        userMarker.current = null;
      }
    };
  }, [mapLoaded, pins, userLocation, handlePinClick]);

  // Filtered pins for list view
  const filteredPins = useMemo(() => {
    if (!pins) return [];
    if (statusFilter === "all") return pins;
    return pins.filter((pin) => pin.status === statusFilter);
  }, [pins, statusFilter]);

  const handleStatusFilterChange = (status: PinStatus | "all") => {
    setStatusFilter(status);
    setShowFilterDropdown(false);
  };

  // Search pins by homeowner name or address
  const searchedPins = useMemo(() => {
    if (!pins) return [];
    if (!searchQuery) return pins;
    const query = searchQuery.toLowerCase();
    return pins.filter((pin) =>
      (pin.homeowner_name?.toLowerCase().includes(query) || false) ||
      (pin.address?.toLowerCase().includes(query) || false)
    );
  }, [pins, searchQuery]);

  // Combined filtered and searched pins for display
  const displayedPins = useMemo(() => {
    return searchedPins.filter(pin => statusFilter === "all" || pin.status === statusFilter);
  }, [searchedPins, statusFilter]);

  const handleAddPinSubmit = async () => {
    // Validate form data
    if (!pinForm.address || !pinForm.homeowner_name) {
      toast.error("Address and homeowner name are required.");
      return;
    }

    // Convert appointment date and time to UTC ISO string
    let appointmentDateTimeUtc: string | null = null;
    if (pinForm.appointment_date && pinForm.appointment_time) {
      const date = new Date(pinForm.appointment_date);
      const time = pinForm.appointment_time.split(":");
      date.setHours(parseInt(time[0]), parseInt(time[1]), 0, 0);
      appointmentDateTimeUtc = date.toISOString();
    }

    try {
      // Create new pin
      const response = await pinsApi.create({
        lat: longPressCoords.current?.lat || 0,
        lng: longPressCoords.current?.lng || 0,
        status: 'lead',
        homeowner_name: pinForm.homeowner_name.trim(),
        address: pinForm.address.trim(),
        notes: pinForm.notes?.trim() || "",
        appointment_date: appointmentDateTimeUtc,
        appointment_end_date: appointmentDateTimeUtc,
        appointment_all_day: false,
        assigned_closer_id: null,
      });
      if (response.error) throw new Error(response.error);

      toast.success("Pin added successfully.");
      setIsAddPinOpen(false);
      setPinForm({
        status: 'lead' as PinStatus,
        homeowner_name: '',
        address: '',
        notes: '',
        appointment_date: '',
        appointment_time: '',
      });
      queryClient.invalidateQueries({ queryKey: ["rep-pins"] });
    } catch (error) {
      toast.error(`Error adding pin: ${(error as Error).message}`);
    }
  };

  const handleAddressChange = (value: string) => {
    setPinForm(prev => ({ ...prev, address: value }));
    if (value.length > 2) {
      searchAddresses(value);
    } else {
      setAddressSuggestions([]);
    }
  };

  const handleAddressSelect = (address: string) => {
    setPinForm(prev => ({ ...prev, address }));
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

  // Create pin mutation
  const createPinMutation = useMutation({
    mutationFn: async (formData: typeof pinForm) => {
      if (!MAPBOX_TOKEN_ENV) {
        throw new Error("Mapbox token missing");
      }

      // Geocode the address to get coordinates
      const geocodeResponse = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(formData.address)}.json?access_token=${MAPBOX_TOKEN_ENV}&limit=1`,
      );
      const geocodeData = await geocodeResponse.json();
      const feature = geocodeData.features?.[0];

      if (!feature) {
        throw new Error("Could not find coordinates for this address");
      }

      const [lng, lat] = feature.center;

      // Prepare pin data
      const pinData: Partial<AwsPin> = {
        lat,
        lng,
        status: formData.status as AwsPin['status'],
        address: formData.address,
        homeowner_name: formData.homeowner_name,
        notes: formData.notes || null,
        deal_id: null,
        homeowner_phone: null,
        homeowner_email: null,
        city: null,
        state: null,
        zip_code: null,
        appointment_date: null,
        appointment_end_date: null,
        appointment_all_day: null,
        assigned_closer_id: null,
      };

      // Add appointment fields if status is appointment
      if (formData.status === "appointment") {
        const appointmentDateTime = new Date(`${formData.appointment_date}T${formData.appointment_time}`).toISOString();
        pinData.appointment_date = appointmentDateTime;
        pinData.appointment_all_day = false;
      }

      const response = await pinsApi.create(pinData);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success("Pin created successfully!");
      setIsAddPinOpen(false);
      setPinForm({
        status: 'lead' as PinStatus,
        homeowner_name: '',
        address: '',
        notes: '',
        appointment_date: '',
        appointment_time: '',
      });
      setAddressSuggestions([]);
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["rep-pins"] });
      queryClient.invalidateQueries({ queryKey: ["closer-appointments"] });
    },
    onError: (error) => {
      console.error("Error creating pin:", error);
      toast.error(error.message || "Failed to create pin");
    },
  });

  const handleAddPin = () => {
    if (!pinForm.homeowner_name || !pinForm.address) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (pinForm.status === "appointment" && (!pinForm.appointment_date || !pinForm.appointment_time)) {
      toast.error('Please fill in appointment date and time');
      return;
    }

    createPinMutation.mutate(pinForm);
  };

  // Debounced address search for autocomplete
  useEffect(() => {
    if (!pinForm.address) {
      setAddressSuggestions([]);
      return;
    }
    setIsSearchingAddress(true);
    const handler = setTimeout(() => {
      fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places?access_token=${MAPBOX_TOKEN_ENV}&limit=5&autocomplete=true&proximity=${userLocation?.[1]},${userLocation?.[0]}&country=us&q=${encodeURIComponent(pinForm.address)}`)
        .then(response => response.json())
        .then(data => {
          const suggestions = data.features?.map((feature: { place_name: string }) => feature.place_name) || [];
          setAddressSuggestions(suggestions);
          setIsSearchingAddress(false);
        })
        .catch(error => {
          console.error("Error fetching address suggestions:", error);
          setIsSearchingAddress(false);
        });
    }, 300);
    return () => {
      clearTimeout(handler);
    };
  }, [pinForm.address, userLocation]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <main className="relative flex-1 overflow-hidden">
        {/* Top Header Bar */}
        <div
          className="absolute inset-x-0 z-[1000] flex flex-col items-center gap-2 px-4"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
        >
          {/* View Tabs */}
          <div className="flex bg-card/95 backdrop-blur-sm rounded-lg border border-border shadow-lg overflow-hidden">
            <button
              onClick={() => setActiveView("map")}
              className={`px-5 py-2 text-sm font-medium transition-colors ${
                activeView === "map" ? "bg-card text-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              Map
            </button>
            <button
              onClick={() => setActiveView("list")}
              className={`px-5 py-2 text-sm font-medium transition-colors ${
                activeView === "list" ? "bg-card text-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              List
            </button>
          </div>

          {/* Stats Cards */}
          <div className="flex gap-1 overflow-x-auto px-2 w-full max-w-full justify-center">
            <div className="flex-shrink-0 bg-card/95 backdrop-blur-sm rounded-lg border border-border shadow-lg p-2 min-w-[80px] sm:min-w-[120px] flex-1 sm:flex-initial">
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Leads</p>
                  <p className="text-sm font-semibold text-foreground">{stats.totalLeads}</p>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 bg-card/95 backdrop-blur-sm rounded-lg border border-border shadow-lg p-2 min-w-[80px] sm:min-w-[120px] flex-1 sm:flex-initial">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Today</p>
                  <p className="text-sm font-semibold text-foreground">{stats.todayAppts}</p>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 bg-card/95 backdrop-blur-sm rounded-lg border border-border shadow-lg p-2 min-w-[80px] sm:min-w-[120px] flex-1 sm:flex-initial">
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-3 h-3 text-purple-500" />
                <div>
                  <p className="text-xs text-muted-foreground">This Week</p>
                  <p className="text-sm font-semibold text-foreground">{stats.thisWeekAppts}</p>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 bg-card/95 backdrop-blur-sm rounded-lg border border-border shadow-lg p-2 min-w-[80px] sm:min-w-[120px] flex-1 sm:flex-initial">
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Installed</p>
                  <p className="text-sm font-semibold text-foreground">{stats.installedCount}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Map View */}
        <div className={`${activeView === "map" ? "block" : "hidden"}`}>
          {!MAPBOX_TOKEN_ENV ? (
            <div
              className="absolute inset-0 flex items-center justify-center p-6"
              style={{ bottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}
            >
              <div className="max-w-md w-full bg-card border border-border rounded-xl p-5 space-y-3">
                <div className="font-semibold text-foreground">Mapbox token missing</div>
                <div className="text-sm text-muted-foreground">
                  Add a <span className="font-medium">public</span> Mapbox token (starts with{" "}
                  <span className="font-mono">pk.</span>) as <span className="font-mono">VITE_MAPBOX_ACCESS_TOKEN</span>
                  .
                </div>
              </div>
            </div>
          ) : !locationObtained ? (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ bottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-muted-foreground">Getting your location...</span>
              </div>
            </div>
          ) : !mapboxReady ? (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ bottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-muted-foreground">Loading map...</span>
              </div>
            </div>
          ) : (
            <div
              ref={mapContainer}
              className="absolute inset-0"
              style={{ bottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}
            />
          )}

          {/* Location Follow Button */}
          <div
            className="absolute right-3 z-[1000]"
            style={{ bottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}
          >
            <button
              onClick={handleLocate}
              className={`w-11 h-11 rounded-full backdrop-blur-sm border shadow-lg flex items-center justify-center transition-colors ${
                isFollowing
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card/95 text-foreground border-border hover:bg-muted"
              }`}
              title={isFollowing ? "Following location" : "Follow my location"}
            >
              {isFollowing ? <Navigation className="w-5 h-5" /> : <Crosshair className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* List View */}
        <div
          className={`absolute inset-0 overflow-auto ${activeView === "list" ? "block" : "hidden"}`}
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 140px)",
            paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {/* Search and Filter Bar */}
          <div className="sticky top-0 z-10 bg-background px-4 py-3 border-b border-border space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="flex items-center gap-2 px-4 py-2.5 bg-muted rounded-lg text-sm font-medium text-foreground"
              >
                <Filter className="w-4 h-4" />
                {statusFilter === "all" ? "All" : statusConfig[statusFilter].label}
                <ChevronDown className="w-4 h-4" />
              </button>

              {showFilterDropdown && (
                <div className="absolute top-full left-0 mt-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50 min-w-[160px]">
                  <button
                    onClick={() => {
                      setStatusFilter("all");
                      setShowFilterDropdown(false);
                    }}
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-muted transition-colors text-foreground ${statusFilter === "all" ? "bg-muted" : ""}`}
                  >
                    All Pins
                  </button>
                  {(Object.keys(statusConfig) as PinStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        setStatusFilter(status);
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2 text-foreground ${statusFilter === status ? "bg-muted" : ""}`}
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
            {filteredPins
              ?.filter((pin) => !searchQuery || pin.homeowner_name?.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((pin) => (
                <button
                  key={pin.id}
                  onClick={() => handlePinClick(pin)}
                  className="w-full p-4 bg-card rounded-lg border border-border text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{pin.homeowner_name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {pin.address || (pin.latitude !== null && pin.latitude !== undefined && pin.longitude !== null && pin.longitude !== undefined ? `${Number(pin.latitude).toFixed(5)}, ${Number(pin.longitude).toFixed(5)}` : "No location")}
                      </p>
                      {pin.status === "appointment" && pin.appointment_date && (
                        <p className="text-xs text-amber-500 flex items-center gap-1 mt-1">
                          <CalendarIcon className="w-3 h-3" />
                          {format(new Date(pin.appointment_date), "MMM d, yyyy h:mm a")}
                        </p>
                      )}
                    </div>
                    <div
                      className="px-3 py-1 rounded-full text-xs font-medium text-white shrink-0 ml-2"
                      style={{ backgroundColor: statusConfig[pin.status]?.color || "#888" }}
                    >
                      {statusConfig[pin.status]?.label || pin.status}
                    </div>
                  </div>
                </button>
              ))}
            {(!filteredPins ||
              filteredPins.filter(
                (pin) => !searchQuery || pin.homeowner_name?.toLowerCase().includes(searchQuery.toLowerCase()),
              ).length === 0) && (
              <div className="text-center py-12 text-muted-foreground">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>
                  {searchQuery
                    ? "No pins match your search."
                    : statusFilter === "all"
                      ? "No pins yet. Hold the map to add one!"
                      : "No pins with this status."}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Add Pin Dialog */}
      <Dialog open={isAddPinOpen} onOpenChange={setIsAddPinOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Pin</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Type
              </Label>
              <div className="col-span-3">
                <select
                  id="status"
                  value={pinForm.status}
                  onChange={(e) => setPinForm(prev => ({ ...prev, status: e.target.value as PinStatus }))}
                  className="w-full h-10 bg-muted rounded-md border border-border focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  {(Object.keys(statusConfig) as PinStatus[]).map((status) => (
                    <option key={status} value={status} className="text-sm">
                      {statusConfig[status].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="homeowner_name" className="text-right">
                Name
              </Label>
              <Input
                id="homeowner_name"
                value={pinForm.homeowner_name}
                onChange={(e) => setPinForm(prev => ({ ...prev, homeowner_name: e.target.value }))}
                className="col-span-3"
                placeholder="Homeowner name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="address" className="text-right">
                Address
              </Label>
              <div className="col-span-3 relative">
                <Input
                  id="address"
                  value={pinForm.address}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  placeholder="Address"
                  className="w-full"
                />
                {isSearchingAddress && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {addressSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-card border border-border rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
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
            </div>
            {pinForm.status === "appointment" && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="appointment_date" className="text-right">
                    Date
                  </Label>
                  <Input
                    id="appointment_date"
                    type="date"
                    value={pinForm.appointment_date}
                    onChange={(e) => setPinForm(prev => ({ ...prev, appointment_date: e.target.value }))}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="appointment_time" className="text-right">
                    Time
                  </Label>
                  <Input
                    id="appointment_time"
                    type="time"
                    value={pinForm.appointment_time}
                    onChange={(e) => setPinForm(prev => ({ ...prev, appointment_time: e.target.value }))}
                    className="col-span-3"
                  />
                </div>
              </>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={pinForm.notes}
                onChange={(e) => setPinForm(prev => ({ ...prev, notes: e.target.value }))}
                className="col-span-3"
                placeholder="Additional notes"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsAddPinOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPin} disabled={createPinMutation.isPending}>
              {createPinMutation.isPending ? "Creating..." : "Create Pin"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

