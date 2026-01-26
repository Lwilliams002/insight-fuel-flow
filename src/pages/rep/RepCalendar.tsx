import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pinsApi, Pin as AwsPin } from "@/integrations/aws/api";
import { useAuth } from "@/contexts/AwsAuthContext";
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
  CalendarIcon,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
  Clock,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

interface CalendarEvent {
  id: string;
  title: string;
  notes?: string;
  date: string;
  time?: string;
  all_day: boolean;
  created_at: string;
}

export default function RepCalendar() {
  const navigate = useNavigate();
  const { user, getIdToken } = useAuth();
  const queryClient = useQueryClient();

  // Calendar
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | undefined>(undefined);

  // Add appointment dialog
  const [isAddAppointmentOpen, setIsAddAppointmentOpen] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({
    homeowner_name: '',
    address: '',
    notes: '',
    appointment_date: '',
    appointment_time: '',
  });
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  // Add event dialog (calendar events without pins)
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: '',
    notes: '',
    event_date: '',
    event_time: '',
    all_day: false,
  });

  // Calendar events stored in localStorage
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  // Load calendar events from localStorage on mount
  useEffect(() => {
    const savedEvents = localStorage.getItem('calendar-events');
    if (savedEvents) {
      try {
        setCalendarEvents(JSON.parse(savedEvents));
      } catch (error) {
        console.error('Error loading calendar events:', error);
      }
    }
  }, []);

  // Save calendar events to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('calendar-events', JSON.stringify(calendarEvents));
  }, [calendarEvents]);

  // Fallback: fetch token from backend if env var isn't present
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const accessToken = await getIdToken();
        if (!accessToken) return;

        // Check if Mapbox token is missing and log warning
        if (!MAPBOX_TOKEN_ENV) {
          console.log("Mapbox token not found in env, please set VITE_MAPBOX_ACCESS_TOKEN");
        }
      } catch (e) {
        console.error("Failed to check for Mapbox token:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getIdToken]);

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

  // Calendar events for selected calendar date
  const selectedDateEvents = useMemo(() => {
    if (!selectedCalendarDate || !calendarEvents) return [];
    return calendarEvents.filter(
      (event) => event.date && isSameDay(new Date(event.date), selectedCalendarDate),
    );
  }, [selectedCalendarDate, calendarEvents]);

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

  // Days with calendar events for highlighting
  const daysWithEvents = useMemo(() => {
    if (!calendarEvents) return new Map<string, CalendarEvent[]>();
    const daysMap = new Map<string, CalendarEvent[]>();
    calendarEvents.forEach((event) => {
      if (event.date) {
        const key = event.date;
        const existing = daysMap.get(key) || [];
        daysMap.set(key, [...existing, event]);
      }
    });
    return daysMap;
  }, [calendarEvents]);

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

  // Dashboard stats
  const stats = useMemo(() => {
    const totalLeads = pins?.length || 0;
    const todayAppts = appointmentPins?.filter(pin => pin.appointment_date && isToday(new Date(pin.appointment_date))).length || 0;
    const thisWeekAppts = appointmentPins?.filter(pin => {
      if (!pin.appointment_date) return false;
      const apptDate = new Date(pin.appointment_date);
      const weekStart = startOfWeek(new Date());
      const weekEnd = endOfWeek(new Date());
      return apptDate >= weekStart && apptDate <= weekEnd;
    }).length || 0;
    const installedCount = pins?.filter(pin => pin.status === 'installed').length || 0;
    return { totalLeads, todayAppts, thisWeekAppts, installedCount };
  }, [pins, appointmentPins]);

  const handlePinClick = (pin: Pin) => {
    navigate(`/map/pin/${pin.id}?from=calendar`);
  };

  const handleAddAppointment = () => {
    if (!appointmentForm.homeowner_name || !appointmentForm.address || !appointmentForm.appointment_date || !appointmentForm.appointment_time) {
      toast.error('Please fill in all required fields');
      return;
    }

    createAppointmentMutation.mutate(appointmentForm);
  };

  const handleAddressChange = (value: string) => {
    setAppointmentForm(prev => ({ ...prev, address: value }));
    if (value.length > 2) {
      searchAddresses(value);
    } else {
      setAddressSuggestions([]);
    }
  };

  const handleAddressSelect = (address: string) => {
    setAppointmentForm(prev => ({ ...prev, address }));
    setAddressSuggestions([]);
  };

  const handleAddEvent = () => {
    if (!eventForm.title || !eventForm.event_date) {
      toast.error('Please fill in title and date');
      return;
    }

    const newEvent = {
      id: Date.now().toString(),
      title: eventForm.title,
      notes: eventForm.notes,
      date: eventForm.event_date,
      time: eventForm.all_day ? null : eventForm.event_time,
      all_day: eventForm.all_day,
      created_at: new Date().toISOString(),
    };

    setCalendarEvents(prev => [...prev, newEvent]);
    setIsAddEventOpen(false);
    setEventForm({
      title: '',
      notes: '',
      event_date: '',
      event_time: '',
      all_day: false,
    });
    toast.success('Event added successfully!');
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

  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (formData: typeof appointmentForm) => {
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

      // Combine date and time into ISO string
      const appointmentDateTime = new Date(`${formData.appointment_date}T${formData.appointment_time}`).toISOString();

      // Create the pin
      const pinData = {
        lat,
        lng,
        status: "appointment" as const,
        address: formData.address,
        homeowner_name: formData.homeowner_name,
        notes: formData.notes,
        appointment_date: appointmentDateTime,
        appointment_all_day: false,
      };

      const response = await pinsApi.create(pinData);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success("Appointment created successfully!");
      setIsAddAppointmentOpen(false);
      setAppointmentForm({
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
      console.error("Error creating appointment:", error);
      toast.error(error.message || "Failed to create appointment");
    },
  });

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <main className="relative flex-1 overflow-hidden">
        {/* Top Header Bar */}
        <div
          className="absolute inset-x-0 z-[1000] flex flex-col items-center gap-2 px-4"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
        >
          {/* Month Name */}
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

          {/* Action Buttons */}
          <div className="flex justify-center gap-2">
            <Dialog open={isAddAppointmentOpen} onOpenChange={setIsAddAppointmentOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Appointment
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Appointment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="homeowner_name">Homeowner Name *</Label>
                    <Input
                      id="homeowner_name"
                      value={appointmentForm.homeowner_name}
                      onChange={(e) => setAppointmentForm(prev => ({ ...prev, homeowner_name: e.target.value }))}
                      placeholder="Enter homeowner name"
                    />
                  </div>

                  <div className="relative">
                    <Label htmlFor="address">Address *</Label>
                    <Input
                      id="address"
                      value={appointmentForm.address}
                      onChange={(e) => handleAddressChange(e.target.value)}
                      placeholder="Enter full address"
                      className="pr-8"
                    />
                    {isSearchingAddress && (
                      <div className="absolute right-3 top-8 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    )}
                    {addressSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-auto mt-1">
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
                    <p className="text-xs text-muted-foreground mt-1">
                      This will automatically create a pin on the map
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="appointment_date">Date *</Label>
                      <Input
                        id="appointment_date"
                        type="date"
                        value={appointmentForm.appointment_date}
                        onChange={(e) => setAppointmentForm(prev => ({ ...prev, appointment_date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="appointment_time">Time *</Label>
                      <Input
                        id="appointment_time"
                        type="time"
                        value={appointmentForm.appointment_time}
                        onChange={(e) => setAppointmentForm(prev => ({ ...prev, appointment_time: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={appointmentForm.notes}
                      onChange={(e) => setAppointmentForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Additional notes..."
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setIsAddAppointmentOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddAppointment}
                      disabled={createAppointmentMutation.isPending}
                      className="flex-1"
                    >
                      {createAppointmentMutation.isPending ? 'Creating...' : 'Create Appointment'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  Add Event
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Event</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="event_title">Event Title *</Label>
                    <Input
                      id="event_title"
                      value={eventForm.title}
                      onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter event title"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="event_date">Date *</Label>
                      <Input
                        id="event_date"
                        type="date"
                        value={eventForm.event_date}
                        onChange={(e) => setEventForm(prev => ({ ...prev, event_date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="event_time">Time</Label>
                      <Input
                        id="event_time"
                        type="time"
                        value={eventForm.event_time}
                        onChange={(e) => setEventForm(prev => ({ ...prev, event_time: e.target.value }))}
                        disabled={eventForm.all_day}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="all_day"
                      checked={eventForm.all_day}
                      onChange={(e) => setEventForm(prev => ({ ...prev, all_day: e.target.checked }))}
                      className="rounded"
                    />
                    <Label htmlFor="all_day">All day event</Label>
                  </div>

                  <div>
                    <Label htmlFor="event_notes">Notes</Label>
                    <Textarea
                      id="event_notes"
                      value={eventForm.notes}
                      onChange={(e) => setEventForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Additional notes..."
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setIsAddEventOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddEvent}
                      className="flex-1"
                    >
                      Add Event
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Calendar View */}
        <div
          className="absolute inset-0 flex flex-col"
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 240px)",
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
                const dayEvents = daysWithEvents.get(dateKey) || [];
                const allDayEvents = [...dayAppointments, ...dayEvents];
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
                      {allDayEvents.slice(0, 3).map((event, eventIndex) => {
                        // Check if it's an appointment or calendar event
                        const isAppointment = 'homeowner_name' in event;
                        return (
                          <div
                            key={event.id || eventIndex}
                            className={cn(
                              "text-[10px] px-1 py-0.5 rounded truncate",
                              isAppointment
                                ? "bg-primary/80 text-primary-foreground"
                                : "bg-blue-500/80 text-white"
                            )}
                          >
                            {isAppointment ? (event.homeowner_name || "Appt") : event.title}
                          </div>
                        );
                      })}
                      {allDayEvents.length > 3 && (
                        <div className="text-[10px] text-muted-foreground px-1">+{allDayEvents.length - 3} more</div>
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

              {/* Appointments and Events List */}
              <div className="flex-1 overflow-auto px-4 pb-3">
                {selectedDateAppointments.length > 0 || selectedDateEvents.length > 0 ? (
                  <div className="space-y-0.5">
                    {/* Sort and combine appointments and events */}
                    {[...selectedDateAppointments, ...selectedDateEvents]
                      .sort((a, b) => {
                        // Check if items are appointments or events
                        const aIsAppointment = 'homeowner_name' in a;
                        const bIsAppointment = 'homeowner_name' in b;

                        // All-day items first
                        const aAllDay = aIsAppointment ? a.appointment_all_day : a.all_day;
                        const bAllDay = bIsAppointment ? b.appointment_all_day : b.all_day;

                        if (aAllDay && !bAllDay) return -1;
                        if (!aAllDay && bAllDay) return 1;

                        // Then by time
                        const aTime = aIsAppointment ? a.appointment_date : a.time;
                        const bTime = bIsAppointment ? b.appointment_date : b.time;

                        if (!aTime && !bTime) return 0;
                        if (!aTime) return 1;
                        if (!bTime) return -1;

                        return new Date(aTime).getTime() - new Date(bTime).getTime();
                      })
                      .map((item) => {
                        const isAppointment = 'homeowner_name' in item;

                        if (isAppointment) {
                          // Render appointment
                          const apptTime = new Date(item.appointment_date!);
                          const initial = (item.homeowner_name?.[0] || "A").toUpperCase();

                          return (
                            <button
                              key={item.id}
                              onClick={() => handlePinClick(item)}
                              className="w-full flex items-center gap-2 py-2 hover:bg-muted/50 rounded-lg transition-colors -mx-1.5 px-1.5"
                            >
                              {/* Time */}
                              <div className="w-14 text-left shrink-0">
                                <div className="text-xs font-medium text-muted-foreground">
                                  {item.appointment_all_day ? "All Day" : format(apptTime, "h:mm a")}
                                </div>
                              </div>

                              {/* Colored Bar */}
                              <div className="w-0.5 h-8 rounded-full bg-primary shrink-0" />

                              {/* Content */}
                              <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {item.homeowner_name || "Unknown"}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{item.address || "No address"}</p>
                              </div>

                              {/* Avatar */}
                              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                                <span className="text-xs font-semibold text-primary-foreground">{initial}</span>
                              </div>
                            </button>
                          );
                        } else {
                          // Render calendar event
                          const eventTime = item.time ? new Date(`${item.date}T${item.time}`) : null;

                          return (
                            <div
                              key={item.id}
                              className="w-full flex items-center gap-2 py-2 rounded-lg -mx-1.5 px-1.5"
                            >
                              {/* Time */}
                              <div className="w-14 text-left shrink-0">
                                <div className="text-xs font-medium text-muted-foreground">
                                  {item.all_day ? "All Day" : eventTime ? format(eventTime, "h:mm a") : ""}
                                </div>
                              </div>

                              {/* Colored Bar */}
                              <div className="w-0.5 h-8 rounded-full bg-blue-500 shrink-0" />

                              {/* Content */}
                              <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {item.title}
                                </p>
                                {item.notes && (
                                  <p className="text-xs text-muted-foreground truncate">{item.notes}</p>
                                )}
                              </div>

                              {/* Event Icon */}
                              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                                <CalendarIcon className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          );
                        }
                      })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No appointments or events on this day</p>
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
