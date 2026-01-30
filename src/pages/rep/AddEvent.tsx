import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RepLayout } from "@/components/RepLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CalendarIcon, Clock, FileText } from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  notes?: string;
  date: string;
  time?: string;
  all_day: boolean;
  created_at: string;
}

export default function AddEvent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    title: "",
    event_date: "",
    event_time: "",
    event_end_time: "",
    all_day: false,
    notes: "",
  });

  useEffect(() => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000); // Add 1 hour

    setFormData(prev => ({
      ...prev,
      event_date: now.toISOString().split('T')[0], // YYYY-MM-DD format
      event_time: now.toTimeString().slice(0, 5), // HH:MM format
      event_end_time: oneHourLater.toTimeString().slice(0, 5), // HH:MM format
    }));
  }, []);

  const createEventMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // For now, we'll store events locally in localStorage
      // In a real app, this would be an API call
      const events = JSON.parse(localStorage.getItem('calendar_events') || '[]');
      const newEvent: CalendarEvent = {
        id: Date.now().toString(),
        title: data.title,
        notes: data.notes,
        date: data.event_date,
        time: data.all_day ? undefined : data.event_time,
        all_day: data.all_day,
        created_at: new Date().toISOString(),
      };
      events.push(newEvent);
      localStorage.setItem('calendar_events', JSON.stringify(events));
      return newEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success('Event created successfully!');
      navigate('/calendar');
    },
    onError: (error: Error) => {
      toast.error('Failed to create event', { description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Event title is required');
      return;
    }
    if (!formData.event_date) {
      toast.error('Event date is required');
      return;
    }
    createEventMutation.mutate(formData);
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
    <RepLayout title="Add Event" showBackButton onBack={() => navigate('/calendar')}>
      <div className="p-4 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Event Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Event Information
            </h3>

            <div>
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter event title"
                required
              />
            </div>

            <div>
              <Label htmlFor="event_date">Date *</Label>
              <Input
                id="event_date"
                type="date"
                value={formData.event_date}
                onChange={(e) => setFormData(prev => ({ ...prev, event_date: e.target.value }))}
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="all_day"
                checked={formData.all_day}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, all_day: !!checked }))}
              />
              <Label htmlFor="all_day">All day event</Label>
            </div>

            {!formData.all_day && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="event_time">Start Time</Label>
                  <Input
                    id="event_time"
                    type="time"
                    value={formData.event_time}
                    onChange={(e) => {
                      const newStartTime = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        event_time: newStartTime,
                        event_end_time: addOneHour(newStartTime)
                      }));
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="event_end_time">End Time</Label>
                  <Input
                    id="event_end_time"
                    type="time"
                    value={formData.event_end_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, event_end_time: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notes
            </h3>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add any notes about this event..."
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
              disabled={createEventMutation.isPending}
            >
              {createEventMutation.isPending ? 'Creating...' : 'Create Event'}
            </Button>
          </div>
        </form>
      </div>
    </RepLayout>
  );
}
