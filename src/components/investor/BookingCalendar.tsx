import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Calendar, List, Plus, DollarSign, Moon, AlertTriangle } from 'lucide-react';

interface Booking {
  id: string;
  platform: string;
  guest_name?: string;
  check_in: string;
  check_out: string;
  nights: number;
  gross_revenue: number;
  net_revenue: number;
  status: string;
  platform_listings?: {
    listing_name: string;
    property_id?: string;
  };
}

interface Props {
  bookings: Booking[];
  onAddDirectBooking: () => void;
}

const PLATFORM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  airbnb: { bg: 'bg-[#FF5A5F]', text: 'text-white', border: 'border-[#FF5A5F]' },
  vrbo: { bg: 'bg-[#3B5998]', text: 'text-white', border: 'border-[#3B5998]' },
  'booking.com': { bg: 'bg-[#003580]', text: 'text-white', border: 'border-[#003580]' },
  direct: { bg: 'bg-emerald-600', text: 'text-white', border: 'border-emerald-600' },
  guesty: { bg: 'bg-purple-600', text: 'text-white', border: 'border-purple-600' },
  hospitable: { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-600' },
  ownerrez: { bg: 'bg-green-600', text: 'text-white', border: 'border-green-600' },
  hostaway: { bg: 'bg-orange-600', text: 'text-white', border: 'border-orange-600' },
  furnished_finder: { bg: 'bg-teal-600', text: 'text-white', border: 'border-teal-600' },
  csv_import: { bg: 'bg-gray-600', text: 'text-white', border: 'border-gray-600' }
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function BookingCalendar({ bookings, onAddDirectBooking }: Props) {
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Get first and last day of current view
  const viewDates = useMemo(() => {
    if (viewMode === 'month') {
      const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      // Extend to full weeks
      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - startDate.getDay());
      const endDate = new Date(lastDay);
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
      return { start: startDate, end: endDate };
    } else {
      // Week view
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return { start: startOfWeek, end: endOfWeek };
    }
  }, [currentDate, viewMode]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    const current = new Date(viewDates.start);
    while (current <= viewDates.end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [viewDates]);

  // Map bookings to dates
  const bookingsByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    bookings.forEach(booking => {
      const checkIn = new Date(booking.check_in);
      const checkOut = new Date(booking.check_out);
      const current = new Date(checkIn);
      while (current < checkOut) {
        const key = current.toISOString().split('T')[0];
        if (!map[key]) map[key] = [];
        map[key].push(booking);
        current.setDate(current.getDate() + 1);
      }
    });
    return map;
  }, [bookings]);

  // Calculate occupancy gaps
  const occupancyGaps = useMemo(() => {
    const gaps: { start: Date; end: Date; days: number }[] = [];
    let gapStart: Date | null = null;
    
    calendarDays.forEach((day, index) => {
      const key = day.toISOString().split('T')[0];
      const hasBooking = bookingsByDate[key]?.length > 0;
      const isToday = day.toDateString() === new Date().toDateString();
      const isFuture = day > new Date();
      
      if (!hasBooking && (isToday || isFuture)) {
        if (!gapStart) gapStart = new Date(day);
      } else if (gapStart) {
        const gapEnd = new Date(calendarDays[index - 1] || day);
        const days = Math.ceil((gapEnd.getTime() - gapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        if (days >= 2) {
          gaps.push({ start: gapStart, end: gapEnd, days });
        }
        gapStart = null;
      }
    });
    
    // Handle gap at end
    if (gapStart) {
      const gapEnd = calendarDays[calendarDays.length - 1];
      const days = Math.ceil((gapEnd.getTime() - gapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (days >= 2) {
        gaps.push({ start: gapStart, end: gapEnd, days });
      }
    }
    
    return gaps;
  }, [calendarDays, bookingsByDate]);

  // Calculate revenue for selected period
  const periodStats = useMemo(() => {
    let totalRevenue = 0;
    let totalNights = 0;
    const platformBreakdown: Record<string, { revenue: number; nights: number }> = {};
    
    bookings.forEach(booking => {
      const checkIn = new Date(booking.check_in);
      const checkOut = new Date(booking.check_out);
      
      // Check if booking overlaps with current view
      if (checkIn <= viewDates.end && checkOut >= viewDates.start) {
        totalRevenue += booking.net_revenue || 0;
        totalNights += booking.nights || 0;
        
        if (!platformBreakdown[booking.platform]) {
          platformBreakdown[booking.platform] = { revenue: 0, nights: 0 };
        }
        platformBreakdown[booking.platform].revenue += booking.net_revenue || 0;
        platformBreakdown[booking.platform].nights += booking.nights || 0;
      }
    });
    
    return { totalRevenue, totalNights, platformBreakdown };
  }, [bookings, viewDates]);

  const navigatePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 7);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    const key = date.toISOString().split('T')[0];
    const dayBookings = bookingsByDate[key] || [];
    if (dayBookings.length === 1) {
      setSelectedBooking(dayBookings[0]);
      setShowDetailModal(true);
    } else if (dayBookings.length > 1) {
      // Show list of bookings for that day
      setShowDetailModal(true);
    }
  };

  const handleBookingClick = (booking: Booking, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBooking(booking);
    setShowDetailModal(true);
  };

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();
  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth();
  const isPast = (date: Date) => date < new Date() && !isToday(date);

  const getPlatformColor = (platform: string) => {
    return PLATFORM_COLORS[platform.toLowerCase()] || PLATFORM_COLORS.csv_import;
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={navigatePrevious} aria-label="Previous period">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="text-lg font-semibold min-w-[200px] text-center">
            {viewMode === 'month' 
              ? `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
              : `Week of ${viewDates.start.toLocaleDateString()}`
            }
          </h3>
          <Button variant="outline" size="icon" onClick={navigateNext} aria-label="Next period">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex border rounded-lg overflow-hidden" role="group" aria-label="View mode">
            <Button
              variant={viewMode === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('month')}
              className={viewMode === 'month' ? 'bg-[#d4a574] hover:bg-[#c49464]' : ''}
              aria-pressed={viewMode === 'month'}
            >
              <Calendar className="w-4 h-4 mr-1" />
              Month
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('week')}
              className={viewMode === 'week' ? 'bg-[#d4a574] hover:bg-[#c49464]' : ''}
              aria-pressed={viewMode === 'week'}
            >
              <List className="w-4 h-4 mr-1" />
              Week
            </Button>
          </div>
          <Button onClick={onAddDirectBooking} className="bg-[#d4a574] hover:bg-[#c49464]">
            <Plus className="w-4 h-4 mr-1" />
            Add Direct Booking
          </Button>
        </div>
      </div>

      {/* Period Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-xl font-bold text-green-600">
                  ${periodStats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-muted-foreground">Period Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Moon className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xl font-bold">{periodStats.totalNights}</p>
                <p className="text-xs text-muted-foreground">Booked Nights</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-xl font-bold text-orange-500">{occupancyGaps.length}</p>
                <p className="text-xs text-muted-foreground">Vacancy Gaps</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs space-y-1">
              <p className="font-medium text-muted-foreground mb-1">By Platform:</p>
              {Object.entries(periodStats.platformBreakdown).slice(0, 3).map(([platform, data]) => (
                <div key={platform} className="flex items-center justify-between">
                  <Badge className={`${getPlatformColor(platform).bg} ${getPlatformColor(platform).text} text-xs`}>
                    {platform}
                  </Badge>
                  <span className="text-xs">${data.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Occupancy Gaps Alert */}
      {occupancyGaps.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="py-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-800">Occupancy Gaps Detected</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {occupancyGaps.slice(0, 5).map((gap, i) => (
                    <Badge key={i} variant="outline" className="border-orange-300 text-orange-700">
                      {gap.start.toLocaleDateString()} - {gap.end.toLocaleDateString()} ({gap.days} days)
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-orange-600 mt-2">
                  Consider listing on Furnished Finder or local Facebook groups to fill these gaps.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-2 sm:p-4">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Booking calendar">
            {calendarDays.map((day, index) => {
              const key = day.toISOString().split('T')[0];
              const dayBookings = bookingsByDate[key] || [];
              const hasBookings = dayBookings.length > 0;
              const today = isToday(day);
              const currentMonth = isCurrentMonth(day);
              const past = isPast(day);
              
              return (
                <button
                  key={index}
                  onClick={() => handleDateClick(day)}
                  className={`
                    min-h-[80px] sm:min-h-[100px] p-1 border rounded-lg text-left transition-colors
                    ${today ? 'border-[#d4a574] border-2' : 'border-gray-200'}
                    ${!currentMonth ? 'bg-gray-50 opacity-50' : 'bg-white'}
                    ${past && !hasBookings ? 'bg-gray-100' : ''}
                    ${hasBookings ? 'hover:bg-gray-50' : 'hover:bg-gray-100'}
                    focus:outline-none focus:ring-2 focus:ring-[#d4a574] focus:ring-offset-1
                  `}
                  aria-label={`${day.toLocaleDateString()}, ${dayBookings.length} bookings`}
                >
                  <div className={`text-sm font-medium mb-1 ${today ? 'text-[#d4a574]' : past ? 'text-gray-400' : ''}`}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayBookings.slice(0, viewMode === 'week' ? 3 : 2).map((booking, i) => {
                      const colors = getPlatformColor(booking.platform);
                      const isCheckIn = new Date(booking.check_in).toDateString() === day.toDateString();
                      const isCheckOut = new Date(booking.check_out).toDateString() === day.toDateString();
                      
                      return (
                        <div
                          key={`${booking.id}-${i}`}
                          onClick={(e) => handleBookingClick(booking, e)}
                          className={`
                            text-xs px-1 py-0.5 rounded truncate cursor-pointer
                            ${colors.bg} ${colors.text}
                            ${isCheckIn ? 'rounded-l-full' : ''}
                            ${isCheckOut ? 'rounded-r-full' : ''}
                          `}
                          title={`${booking.guest_name || 'Guest'} - ${booking.platform}`}
                        >
                          {viewMode === 'week' ? (
                            <span>{booking.guest_name || booking.platform}</span>
                          ) : (
                            <span className="hidden sm:inline">{booking.platform.slice(0, 3)}</span>
                          )}
                        </div>
                      );
                    })}
                    {dayBookings.length > (viewMode === 'week' ? 3 : 2) && (
                      <div className="text-xs text-gray-500 px-1">
                        +{dayBookings.length - (viewMode === 'week' ? 3 : 2)} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Platform Legend */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-muted-foreground mr-2">Platforms:</span>
            {Object.entries(PLATFORM_COLORS).slice(0, 6).map(([platform, colors]) => (
              <Badge key={platform} className={`${colors.bg} ${colors.text} capitalize`}>
                {platform.replace('_', ' ')}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Booking Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent aria-describedby="booking-detail-description">
          <DialogHeader>
            <DialogTitle>
              {selectedDate && !selectedBooking 
                ? `Bookings for ${selectedDate.toLocaleDateString()}`
                : 'Booking Details'
              }
            </DialogTitle>
            <DialogDescription id="booking-detail-description">
              {selectedBooking 
                ? `${selectedBooking.platform} booking details`
                : selectedDate 
                  ? `View bookings for this date`
                  : 'Booking information'
              }
            </DialogDescription>
          </DialogHeader>

          {selectedBooking ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={`${getPlatformColor(selectedBooking.platform).bg} ${getPlatformColor(selectedBooking.platform).text}`}>
                  {selectedBooking.platform}
                </Badge>
                <Badge variant={selectedBooking.status === 'completed' ? 'default' : 'outline'}>
                  {selectedBooking.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Guest</p>
                  <p className="font-medium">{selectedBooking.guest_name || 'Guest'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Listing</p>
                  <p className="font-medium">{selectedBooking.platform_listings?.listing_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Check-in</p>
                  <p className="font-medium">{new Date(selectedBooking.check_in).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Check-out</p>
                  <p className="font-medium">{new Date(selectedBooking.check_out).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nights</p>
                  <p className="font-medium">{selectedBooking.nights}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net Revenue</p>
                  <p className="font-medium text-green-600">
                    ${selectedBooking.net_revenue?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>

              {selectedBooking.gross_revenue !== selectedBooking.net_revenue && (
                <div className="pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gross Revenue</span>
                    <span>${selectedBooking.gross_revenue?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Platform Fees</span>
                    <span className="text-red-500">
                      -${((selectedBooking.gross_revenue || 0) - (selectedBooking.net_revenue || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : selectedDate ? (
            <div className="space-y-2">
              {(bookingsByDate[selectedDate.toISOString().split('T')[0]] || []).map((booking) => (
                <button
                  key={booking.id}
                  onClick={() => setSelectedBooking(booking)}
                  className="w-full p-3 border rounded-lg text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={`${getPlatformColor(booking.platform).bg} ${getPlatformColor(booking.platform).text}`}>
                        {booking.platform}
                      </Badge>
                      <span className="font-medium">{booking.guest_name || 'Guest'}</span>
                    </div>
                    <span className="text-green-600 font-medium">
                      ${booking.net_revenue?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(booking.check_in).toLocaleDateString()} - {new Date(booking.check_out).toLocaleDateString()}
                  </p>
                </button>
              ))}
              {(bookingsByDate[selectedDate.toISOString().split('T')[0]] || []).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p>No bookings on this date</p>
                  <Button 
                    onClick={() => {
                      setShowDetailModal(false);
                      onAddDirectBooking();
                    }}
                    className="mt-4 bg-[#d4a574] hover:bg-[#c49464]"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Direct Booking
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
