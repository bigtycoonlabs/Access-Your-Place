import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar as CalendarIcon, Clock, Plus, ChevronLeft, ChevronRight,
  Phone, Video, Building2, FileText, Loader2, MapPin,
  CheckCircle2, AlertCircle, Trash2, Cloud, CloudOff
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_type: 'call' | 'milestone' | 'deadline' | 'viewing' | 'meeting' | 'reminder';
  event_date: string;
  event_time?: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  location?: string;
  related_property?: string;
  created_at: string;
}

const EVENT_TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  call: { icon: <Phone className="w-4 h-4" />, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  milestone: { icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-green-600', bgColor: 'bg-green-100' },
  deadline: { icon: <AlertCircle className="w-4 h-4" />, color: 'text-red-600', bgColor: 'bg-red-100' },
  viewing: { icon: <Building2 className="w-4 h-4" />, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  meeting: { icon: <Video className="w-4 h-4" />, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  reminder: { icon: <CalendarIcon className="w-4 h-4" />, color: 'text-amber-600', bgColor: 'bg-amber-100' }
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  investorId: string;
  investorName: string;
}

export function InvestorCalendar({ investorId, investorName }: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    event_type: 'call' as CalendarEvent['event_type'],
    event_date: '',
    event_time: '',
    location: '',
    related_property: ''
  });
  const { toast } = useToast();

  // Load events from DB with localStorage fallback
  useEffect(() => {
    fetchEvents();
  }, [investorId]);

  const updateLocalCache = useCallback((eventList: CalendarEvent[]) => {
    localStorage.setItem(`investor_calendar_${investorId}`, JSON.stringify(eventList));
  }, [investorId]);

  const fetchEvents = async () => {
    setLoading(true);
    
    // Load from localStorage first for instant display
    const stored = localStorage.getItem(`investor_calendar_${investorId}`);
    let localEvents: CalendarEvent[] = stored ? JSON.parse(stored) : [];
    if (localEvents.length > 0) {
      setEvents(localEvents);
    }

    try {
      // Check if there are local-only events that need syncing
      const hasLocalOnly = localEvents.some(e => e.id.startsWith('local_'));
      
      if (hasLocalOnly && localEvents.length > 0) {
        // Sync local events to DB
        const { data } = await supabase.functions.invoke('manage-investor-progress', {
          body: { 
            action: 'sync_calendar_events', 
            investor_id: investorId,
            events: localEvents
          }
        });
        if (data?.success && data.events) {
          setEvents(data.events);
          updateLocalCache(data.events);
          setSynced(true);
        }
      } else {
        // Just fetch from DB
        const { data } = await supabase.functions.invoke('manage-investor-progress', {
          body: { action: 'get_calendar_events', investor_id: investorId }
        });
        if (data?.success && data.events) {
          setEvents(data.events);
          updateLocalCache(data.events);
          setSynced(true);
        }
      }
    } catch (err) {
      console.error('Error fetching calendar events from DB:', err);
      // localStorage data is already loaded above
    }
    setLoading(false);
  };

  const addEvent = async () => {
    if (!eventForm.title || !eventForm.event_date) {
      toast({ title: 'Missing Information', description: 'Please provide a title and date.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    
    // Optimistic local update with temp ID
    const tempEvent: CalendarEvent = {
      id: `local_${Date.now()}`,
      title: eventForm.title,
      description: eventForm.description,
      event_type: eventForm.event_type,
      event_date: eventForm.event_date,
      event_time: eventForm.event_time,
      status: 'upcoming',
      location: eventForm.location,
      related_property: eventForm.related_property,
      created_at: new Date().toISOString()
    };

    // Add to local state immediately
    const updatedLocal = [...events, tempEvent];
    setEvents(updatedLocal);
    updateLocalCache(updatedLocal);

    try {
      const { data } = await supabase.functions.invoke('manage-investor-progress', {
        body: { 
          action: 'add_calendar_event', 
          investor_id: investorId,
          event: tempEvent
        }
      });
      
      if (data?.success && data.event) {
        // Replace temp event with DB event (has real UUID)
        const updatedWithReal = updatedLocal.map(e => 
          e.id === tempEvent.id ? { ...data.event } : e
        );
        setEvents(updatedWithReal);
        updateLocalCache(updatedWithReal);
        setSynced(true);
      }
    } catch (err) {
      console.error('Failed to save event to DB:', err);
      setSynced(false);
      // Event is still in local state
    }
    
    toast({ title: 'Event Added', description: `"${eventForm.title}" has been added to your calendar.` });
    setShowAddModal(false);
    setEventForm({ title: '', description: '', event_type: 'call', event_date: '', event_time: '', location: '', related_property: '' });
    setSubmitting(false);
  };

  const deleteEvent = async (eventId: string) => {
    // Optimistic local delete
    const updated = events.filter(e => e.id !== eventId);
    setEvents(updated);
    updateLocalCache(updated);

    // Delete from DB if it's a real DB event
    if (!eventId.startsWith('local_')) {
      try {
        await supabase.functions.invoke('manage-investor-progress', {
          body: { 
            action: 'delete_calendar_event', 
            investor_id: investorId,
            event_id: eventId
          }
        });
      } catch (err) {
        console.error('Failed to delete event from DB:', err);
      }
    }
    
    toast({ title: 'Event Removed' });
  };

  const toggleEventStatus = async (eventId: string) => {
    const updated = events.map(e => {
      if (e.id === eventId) {
        return { ...e, status: e.status === 'completed' ? 'upcoming' as const : 'completed' as const };
      }
      return e;
    });
    setEvents(updated);
    updateLocalCache(updated);

    // Update in DB
    if (!eventId.startsWith('local_')) {
      const event = updated.find(e => e.id === eventId);
      if (event) {
        try {
          await supabase.functions.invoke('manage-investor-progress', {
            body: { 
              action: 'update_calendar_event', 
              investor_id: investorId,
              event_id: eventId,
              updates: { status: event.status }
            }
          });
        } catch (err) {
          console.error('Failed to update event status in DB:', err);
        }
      }
    }
  };

  // Calendar grid helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const getEventsForDate = (date: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    return events.filter(e => e.event_date === dateStr);
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const upcomingEvents = events
    .filter(e => e.status === 'upcoming' && new Date(e.event_date) >= new Date(today.toDateString()))
    .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
    .slice(0, 5);

  const selectedDateEvents = selectedDate 
    ? getEventsForDate(selectedDate.getDate())
    : [];

  if (loading && events.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-[#d4a574]" />
            Calendar & Milestones
            {synced ? (
              <Cloud className="w-4 h-4 text-green-500" title="Synced to cloud" />
            ) : (
              <CloudOff className="w-4 h-4 text-gray-400" title="Saved locally only" />
            )}
          </h2>
          <p className="text-sm text-gray-500">Track calls, deadlines, and acquisition milestones</p>
        </div>
        <Button onClick={() => {
          setEventForm(prev => ({
            ...prev,
            event_date: selectedDate 
              ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
              : ''
          }));
          setShowAddModal(true);
        }} className="bg-[#d4a574] hover:bg-[#c49464]">
          <Plus className="w-4 h-4 mr-2" />
          Add Event
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={prevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <CardTitle className="text-lg">
                {MONTHS[month]} {year}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={nextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS.map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="h-16" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const date = i + 1;
                const dayEvents = getEventsForDate(date);
                const isToday = today.getDate() === date && today.getMonth() === month && today.getFullYear() === year;
                const isSelected = selectedDate?.getDate() === date && selectedDate?.getMonth() === month && selectedDate?.getFullYear() === year;

                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(new Date(year, month, date))}
                    className={`h-16 rounded-lg text-sm relative transition-all p-1 ${
                      isSelected 
                        ? 'bg-[#d4a574] text-white ring-2 ring-[#d4a574] ring-offset-1' 
                        : isToday 
                          ? 'bg-blue-50 border-2 border-blue-300 font-bold' 
                          : 'hover:bg-gray-100'
                    }`}
                  >
                    <span className={`text-xs ${isSelected ? 'text-white' : isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                      {date}
                    </span>
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                        {dayEvents.slice(0, 3).map(event => {
                          const config = EVENT_TYPE_CONFIG[event.event_type];
                          return (
                            <div
                              key={event.id}
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSelected ? 'bg-white' : config.bgColor.replace('bg-', 'bg-').replace('100', '500')
                              }`}
                            />
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <span className={`text-[8px] ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                            +{dayEvents.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Selected Date Events */}
          {selectedDate && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDateEvents.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No events on this date</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDateEvents.map(event => {
                      const config = EVENT_TYPE_CONFIG[event.event_type];
                      return (
                        <div key={event.id} className={`flex items-start gap-2 p-2 rounded-lg ${event.status === 'completed' ? 'opacity-60' : ''}`}>
                          <div className={`p-1.5 rounded ${config.bgColor} flex-shrink-0 mt-0.5`}>
                            <span className={config.color}>{config.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${event.status === 'completed' ? 'line-through' : ''}`}>
                              {event.title}
                            </p>
                            {event.event_time && (
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {event.event_time}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => toggleEventStatus(event.id)} className="p-1 hover:bg-gray-100 rounded">
                              <CheckCircle2 className={`w-4 h-4 ${event.status === 'completed' ? 'text-green-500' : 'text-gray-300'}`} />
                            </button>
                            <button onClick={() => deleteEvent(event.id)} className="p-1 hover:bg-red-50 rounded">
                              <Trash2 className="w-4 h-4 text-gray-300 hover:text-red-500" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Upcoming Events */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#d4a574]" />
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-6">
                  <CalendarIcon className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">No upcoming events</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setShowAddModal(true)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Event
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map(event => {
                    const config = EVENT_TYPE_CONFIG[event.event_type];
                    const eventDate = new Date(event.event_date + 'T00:00:00');
                    const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <div key={event.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
                        <div className={`p-1.5 rounded ${config.bgColor} flex-shrink-0`}>
                          <span className={config.color}>{config.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
                          <p className="text-xs text-gray-500">
                            {eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {event.event_time && ` at ${event.event_time}`}
                          </p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`text-xs flex-shrink-0 ${daysUntil <= 1 ? 'border-red-300 text-red-600' : daysUntil <= 3 ? 'border-amber-300 text-amber-600' : ''}`}
                        >
                          {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d`}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Legend */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Event Types</p>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(EVENT_TYPE_CONFIG).map(([type, config]) => (
                  <div key={type} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className={config.color}>{config.icon}</span>
                    <span className="capitalize">{type}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Event Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#d4a574]" />
              Add Calendar Event
            </DialogTitle>
            <DialogDescription>
              Schedule a call, set a deadline, or track a milestone
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); addEvent(); }} className="space-y-4">
            <div>
              <Label htmlFor="event-title">Title *</Label>
              <Input
                id="event-title"
                value={eventForm.title}
                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                placeholder="e.g., Discovery Call with AM"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="event-type">Event Type</Label>
                <Select
                  value={eventForm.event_type}
                  onValueChange={(v: CalendarEvent['event_type']) => setEventForm({ ...eventForm, event_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Phone Call</SelectItem>
                    <SelectItem value="meeting">Video Meeting</SelectItem>
                    <SelectItem value="viewing">Property Viewing</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                    <SelectItem value="deadline">Deadline</SelectItem>
                    <SelectItem value="reminder">Reminder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="event-date">Date *</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={eventForm.event_date}
                  onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="event-time">Time</Label>
                <Input
                  id="event-time"
                  placeholder="e.g., 2:00 PM EST"
                  value={eventForm.event_time}
                  onChange={(e) => setEventForm({ ...eventForm, event_time: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="event-location">Location</Label>
                <Input
                  id="event-location"
                  placeholder="e.g., Zoom, Phone"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="event-description">Notes</Label>
              <Textarea
                id="event-description"
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                placeholder="Any additional details..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-[#d4a574] hover:bg-[#c49464]">
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add Event
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
