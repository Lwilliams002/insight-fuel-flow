import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { pinsApi, Pin as AwsPin } from "@/integrations/aws/api";
import { useAuth } from "@/contexts/AwsAuthContext";
import { awsConfig } from "@/integrations/aws/config";
import { BottomNav } from "@/components/BottomNav";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  format,
  isSameDay,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  isToday,
  startOfWeek,
  endOfWeek,
  addDays,
} from "date-fns";
import {
  MapPin,
  Crosshair,
  X,
  CalendarIcon,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Navigation,
} from "lucide-react";
import { Input } from "@/components/ui/input";

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

interface NewPinData {
  lat: number;
  lng: number;
}

export default function RepMap() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, getIdToken } = useAuth();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressCoords = useRef<{ lng: number; lat: number } | null>(null);
  const mapboxglRef = useRef<typeof mapboxgl | null>(null);

  // Read initial tab from URL
  const initialTab = searchParams.get("tab") as "map" | "list" | "calendar" | null;
  const [activeView, setActiveView] = useState<"map" | "list" | "calendar">(initialTab || "map");
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationObtained, setLocationObtained] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string | undefined>(MAPBOX_TOKEN_ENV);
  const [mapboxReady, setMapboxReady] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<PinStatus | "all">("all");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Follow mode - automatically center map on user location
  const [isFollowing, setIsFollowing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Calendar
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | undefined>(undefined);

  // Fallback: fetch token from backend if env var isn't present
  useEffect(() => {
    if (mapboxToken) return;
    let cancelled = false;

    (async () => {
      try {
        const accessToken = await getIdToken();
        if (!accessToken) return;

        // For now, just use the env var - backend token endpoint can be added later
        // The mapbox token should be set via VITE_MAPBOX_ACCESS_TOKEN
        console.log("Mapbox token not found in env, please set VITE_MAPBOX_ACCESS_TOKEN");
      } catch (e) {
        console.error("Failed to check for Mapbox token:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mapboxToken, getIdToken]);

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

  // Initialize Mapbox - only runs once when location is first obtained
  useEffect(() => {
    if (!mapboxToken) return;
    if (!mapboxReady || !mapboxglRef.current) return;
    if (!mapContainer.current) return;
    if (map.current) return; // Already initialized
    if (!locationObtained || !userLocation) return; // Wait for location

    const mapboxgl = mapboxglRef.current;
    mapboxgl.accessToken = mapboxToken;

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
  }, [mapboxToken, mapboxReady, locationObtained]); // Don't include userLocation to prevent re-init on location updates

  // Force map resize when switching back to map view
  useEffect(() => {
    if (activeView === "map" && map.current) {
      setTimeout(() => {
        map.current?.resize();
      }, 100);
    }
  }, [activeView]);

  // Fetch rep's pins from AWS
  const { data: pins, isLoading } = useQuery({
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

  // Filtered pins for list view
  const filteredPins = useMemo(() => {
    if (!pins) return [];
    if (statusFilter === "all") return pins;
    return pins.filter((pin) => pin.status === statusFilter);
  }, [pins, statusFilter]);

  // Appointments for calendar (own pins + assigned as closer)
  const appointmentPins = useMemo(() => {
    const ownAppointments = (pins || []).filter((pin) => pin.status === "appointment" && pin.appointment_date);
    const closerAppts = (closerAppointments || []).filter((pin) => 
      !ownAppointments.some(p => p.id === pin.id) // Avoid duplicates
    );
    return [...ownAppointments, ...closerAppts];
  }, [pins, closerAppointments]);

  // Appointments for selected calendar date
  const selectedDateAppointments = useMemo(() => {
    if (!selectedCalendarDate || !appointmentPins) return [];
    return appointmentPins.filter(
      (pin) => pin.appointment_date && isSameDay(new Date(pin.appointment_date), selectedCalendarDate),
    );
  }, [selectedCalendarDate, appointmentPins]);

  // Days with appointments for calendar highlighting
  const daysWithAppointments = useMemo(() => {
    if (!appointmentPins) return new Map<string, Pin[]>();
    const daysMap = new Map<string, Pin[]>();
    appointmentPins.forEach((pin) => {
      if (pin.appointment_date) {
        const key = format(new Date(pin.appointment_date), "yyyy-MM-dd");
        const existing = daysMap.get(key) || [];
        daysMap.set(key, [...existing, pin]);
      }
    });
    return daysMap;
  }, [appointmentPins]);

  // Get calendar grid days (includes previous/next month padding)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: Date[] = [];
    let currentDay = calendarStart;
    while (currentDay <= calendarEnd) {
      days.push(currentDay);
      currentDay = addDays(currentDay, 1);
    }
    return days;
  }, [calendarMonth]);

  // Update user location marker
  useEffect(() => {
    if (!map.current || !mapLoaded || !mapboxglRef.current || !userLocation) return;

    const mapboxgl = mapboxglRef.current;

    if (!userMarker.current) {
      const el = document.createElement("div");
      el.className = "user-location-marker";
      el.innerHTML = `
        <div style="position: relative; width: 24px; height: 24px;">
          <div style="
            position: absolute;
            top: 0; left: 0;
            width: 24px;
            height: 24px;
            background: rgba(201, 162, 77, 0.3);
            border-radius: 50%;
            animation: pulse 2s ease-out infinite;
          "></div>
          <div style="
            position: absolute;
            top: 6px; left: 6px;
            width: 12px;
            height: 12px;
            background: #C9A24D;
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
    if (!map.current || !mapLoaded || !pins || !mapboxglRef.current) return;

    const mapboxgl = mapboxglRef.current;

    markers.current.forEach((marker) => marker.remove());
    markers.current.clear();

    pins.forEach((pin) => {
      const el = document.createElement("div");
      el.className = "custom-marker";
      el.innerHTML = `
        <div style="
          background-color: ${statusConfig[pin.status]?.color || "#888"};
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

      el.addEventListener("click", () => handlePinClick(pin));

      const marker = new mapboxgl.Marker({ element: el }).setLngLat([pin.longitude, pin.latitude]).addTo(map.current!);

      markers.current.set(pin.id, marker);
    });
  }, [pins, mapLoaded]);

  const handleMapLongPress = async (lat: number, lng: number) => {
    if (!mapboxToken) {
      toast.error("Map token missing. Please set a public Mapbox token (pk.*).");
      return;
    }
    const loadingToast = toast.loading("Getting address...");

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}`,
      );
      const data = await response.json();
      const address = data.features?.[0]?.place_name || "";

      if (!address) {
        toast.dismiss(loadingToast);
        toast.error("Could not determine address for this location.");
        return;
      }

      // Check if address already exists in pins
      const addressExists = pins?.some(pin =>
        pin.address?.toLowerCase().trim() === address.toLowerCase().trim()
      );

      if (addressExists) {
        toast.dismiss(loadingToast);
        toast.error("This address already has a pin. Please contact management.", { duration: 5000 });
        return;
      }

      toast.dismiss(loadingToast);

      // Navigate to new pin page with coordinates and address
      navigate(`/map/pin/new?lat=${lat}&lng=${lng}&address=${encodeURIComponent(address)}&from=${activeView}`);
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error("Error during pin creation:", error);
      toast.error("Failed to get address. Please try again.");
    }
  };

  const handlePinClick = (pin: Pin) => {
    navigate(`/map/pin/${pin.id}?from=${activeView}`);
  };

  const handleLocate = () => {
    setIsFollowing((prev) => !prev);
    if (map.current && userLocation) {
      map.current.flyTo({ center: [userLocation[1], userLocation[0]], zoom: 17 });
    }
  };

  // When in follow mode, center map on location updates
  useEffect(() => {
    if (isFollowing && map.current && userLocation) {
      map.current.easeTo({ center: [userLocation[1], userLocation[0]], duration: 500 });
    }
  }, [userLocation, isFollowing]);

  // Disable follow mode when user manually pans the map
  useEffect(() => {
    if (!map.current) return;

    const handleDragStart = () => {
      if (isFollowing) {
        setIsFollowing(false);
      }
    };

    map.current.on("dragstart", handleDragStart);

    return () => {
      map.current?.off("dragstart", handleDragStart);
    };
  }, [isFollowing]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <main className="relative flex-1 overflow-hidden">
        {/* Top Header Bar */}
        <div
          className="absolute inset-x-0 z-[1000] flex flex-col items-center gap-2 px-4"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
        >
          {/* Month Name - Only in Calendar View */}
          {activeView === "calendar" && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                className="p-2 rounded-full bg-card/95 backdrop-blur-sm border border-border shadow-lg hover:bg-muted transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-foreground" />
              </button>
              <div className="bg-card/95 backdrop-blur-sm rounded-lg border border-border shadow-lg px-5 py-2 min-w-[150px] text-center">
                <span className="text-sm font-medium text-foreground">{format(calendarMonth, "MMMM yyyy")}</span>
              </div>
              <button
                onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                className="p-2 rounded-full bg-card/95 backdrop-blur-sm border border-border shadow-lg hover:bg-muted transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-foreground" />
              </button>
            </div>
          )}

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
            <button
              onClick={() => setActiveView("calendar")}
              className={`px-5 py-2 text-sm font-medium transition-colors ${
                activeView === "calendar" ? "bg-card text-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              Calendar
            </button>
          </div>
        </div>

        {/* Map View */}
        <div className={`${activeView === "map" ? "block" : "hidden"}`}>
          {!mapboxToken ? (
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
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 64px)",
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
                        {pin.address || `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`}
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

        {/* Calendar View */}
        <div
          className={`absolute inset-0 flex flex-col ${activeView === "calendar" ? "flex" : "hidden"}`}
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 120px)",
            paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 border-b border-border bg-background">
            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => (
              <div key={day} className="text-center py-2 text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-7 auto-rows-fr min-h-full">
              {calendarDays.map((day, index) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const dayAppointments = daysWithAppointments.get(dateKey) || [];
                const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                const isSelected = selectedCalendarDate && isSameDay(day, selectedCalendarDate);
                const isTodayDate = isToday(day);

                return (
                  <button
                    key={index}
                    onClick={() => navigate(`/map/date/${format(day, "yyyy-MM-dd")}?from=calendar`)}
                    className={cn(
                      "flex flex-col p-1 border-b border-r border-border min-h-[80px] text-left transition-colors",
                      !isCurrentMonth && "opacity-40",
                      isSelected && "bg-primary/10",
                      !isSelected && "hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1",
                        isTodayDate && "bg-primary text-primary-foreground",
                        !isTodayDate && isCurrentMonth && "text-foreground",
                        !isTodayDate && !isCurrentMonth && "text-muted-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {/* Event Pills */}
                    <div className="flex-1 space-y-0.5 overflow-hidden">
                      {dayAppointments.slice(0, 3).map((appt) => (
                        <div
                          key={appt.id}
                          className="text-[10px] px-1 py-0.5 rounded bg-primary/80 text-primary-foreground truncate"
                        >
                          {appt.homeowner_name || "Appt"}
                        </div>
                      ))}
                      {dayAppointments.length > 3 && (
                        <div className="text-[10px] text-muted-foreground px-1">+{dayAppointments.length - 3} more</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Detail Panel (Bottom Sheet Style) */}
          {selectedCalendarDate && (
            <div
              className="absolute inset-x-0 bottom-0 bg-card border-t border-border rounded-t-3xl shadow-2xl max-h-[60vh] flex flex-col"
              style={{ bottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}
            >
              {/* Drag Handle */}
              <div className="flex-shrink-0 pt-3 pb-1">
                <div className="w-12 h-1 bg-muted rounded-full mx-auto" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2">
                <h3 className="text-base font-semibold text-foreground">
                  {format(selectedCalendarDate, "EEE, MMM d")}
                </h3>
                <button
                  onClick={() => setSelectedCalendarDate(undefined)}
                  className="p-1.5 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Appointments List */}
              <div className="flex-1 overflow-auto px-4 pb-3">
                {selectedDateAppointments.length > 0 ? (
                  <div className="space-y-0.5">
                    {selectedDateAppointments
                      .sort((a, b) => {
                        // All-day appointments first, then by time
                        if (a.appointment_all_day && !b.appointment_all_day) return -1;
                        if (!a.appointment_all_day && b.appointment_all_day) return 1;
                        return new Date(a.appointment_date!).getTime() - new Date(b.appointment_date!).getTime();
                      })
                      .map((pin) => {
                        const apptTime = new Date(pin.appointment_date!);
                        const initial = (pin.homeowner_name?.[0] || "A").toUpperCase();

                        return (
                          <button
                            key={pin.id}
                            onClick={() => handlePinClick(pin)}
                            className="w-full flex items-center gap-2 py-2 hover:bg-muted/50 rounded-lg transition-colors -mx-1.5 px-1.5"
                          >
                            {/* Time */}
                            <div className="w-14 text-left shrink-0">
                              <div className="text-xs font-medium text-muted-foreground">
                                {pin.appointment_all_day ? "All Day" : format(apptTime, "h:mm a")}
                              </div>
                            </div>

                            {/* Colored Bar */}
                            <div className="w-0.5 h-8 rounded-full bg-primary shrink-0" />

                            {/* Content */}
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-sm font-medium text-foreground truncate">
                                {pin.homeowner_name || "Unknown"}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{pin.address || "No address"}</p>
                            </div>

                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                              <span className="text-xs font-semibold text-primary-foreground">{initial}</span>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No appointments on this day</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
