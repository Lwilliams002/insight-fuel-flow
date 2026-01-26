import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { pinsApi, Pin } from '@/integrations/aws/api';
import { useAuth } from '@/contexts/AwsAuthContext';
import { ChevronLeft, MapPin, CalendarIcon, Clock, Users } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';

type PinStatus = 'lead' | 'followup' | 'installed' | 'appointment';

const statusConfig: Record<PinStatus, { color: string; label: string }> = {
  lead: { color: '#3B82F6', label: 'Lead' },
  followup: { color: '#F59E0B', label: 'Follow Up' },
  installed: { color: '#10B981', label: 'Installed' },
  appointment: { color: '#8B5CF6', label: 'Appointment' },
};

export default function CalendarDateDetails() {
  const navigate = useNavigate();
  const { date } = useParams<{ date: string }>();
  const [searchParams] = useSearchParams();
  const fromTab = searchParams.get('from') || 'calendar';
  const { user } = useAuth();

  const selectedDate = date ? parseISO(date) : new Date();

  // Fetch all pins and filter by appointment date
  const { data: appointments, isLoading } = useQuery({
    queryKey: ['calendar-date-appointments', date],
    queryFn: async () => {
      const response = await pinsApi.list();
      if (response.error) throw new Error(response.error);

      const dayStart = startOfDay(selectedDate);
      const dayEnd = endOfDay(selectedDate);

      // Filter pins that are appointments on this date
      const filteredPins = (response.data || [])
        .filter(pin => {
          if (pin.status !== 'appointment' || !pin.appointment_date) return false;
          const appointmentDate = new Date(pin.appointment_date);
          return appointmentDate >= dayStart && appointmentDate <= dayEnd;
        })
        .map(pin => ({
          ...pin,
          isCloserAssignment: pin.assigned_closer_id === user?.sub && pin.rep_id !== user?.sub,
        }))
        .sort((a, b) => {
          // Sort by appointment_date
          const dateA = new Date(a.appointment_date!);
          const dateB = new Date(b.appointment_date!);
          return dateA.getTime() - dateB.getTime();
        });

      return filteredPins;
    },
    enabled: !!date,
  });


  const handleBack = () => {
    navigate(`/map?tab=${fromTab}`);
  };

  const handlePinClick = (pinId: string) => {
    navigate(`/map/pin/${pinId}?from=calendar`);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
        {/* Header */}
        <div 
          className="sticky top-0 z-10 bg-background border-b border-border"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="flex items-center gap-3 p-4">
            <button
              onClick={handleBack}
              className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold">
                {format(selectedDate, 'EEEE, MMMM d')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {appointments?.length || 0} appointment{appointments?.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 space-y-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : appointments && appointments.length > 0 ? (
            appointments.map((pin) => (
              <button
                key={pin.id}
                onClick={() => handlePinClick(pin.id)}
                className="w-full p-4 bg-card rounded-lg border border-border text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div
                        className="px-2.5 py-1 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: statusConfig[pin.status as PinStatus]?.color || '#888' }}
                      >
                        {statusConfig[pin.status as PinStatus]?.label || pin.status}
                      </div>
                      {pin.isCloserAssignment && (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Assigned to you
                        </Badge>
                      )}
                      {pin.appointment_all_day && (
                        <Badge variant="secondary" className="text-xs">
                          All Day
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium text-foreground">
                      {pin.homeowner_name || 'Unknown'}
                    </p>
                    {pin.address && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{pin.address}</span>
                      </p>
                    )}
                    {pin.appointment_date && !pin.appointment_all_day && (
                      <p className="text-sm text-primary flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        {format(new Date(pin.appointment_date), 'h:mm a')}
                        {pin.appointment_end_date && (
                          <> - {format(new Date(pin.appointment_end_date), 'h:mm a')}</>
                        )}
                      </p>
                    )}
                    {pin.notes && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {pin.notes}
                      </p>
                    )}
                  </div>
                  <ChevronLeft className="w-5 h-5 text-muted-foreground rotate-180 shrink-0 ml-2" />
                </div>
              </button>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No appointments</p>
              <p className="text-sm mt-1">No appointments scheduled for this date.</p>
            </div>
          )}
        </div>
      </div>
  );
}
