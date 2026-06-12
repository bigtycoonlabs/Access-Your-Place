import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SEO, { getBreadcrumbSchema } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MarketplaceHeader } from '@/components/marketplace/MarketplaceHeader';
import { MarketplaceFilters, MarketplaceFiltersState } from '@/components/marketplace/MarketplaceFilters';
import { MarketplaceDealCard } from '@/components/marketplace/MarketplaceDealCard';
import { QuickViewModal } from '@/components/marketplace/QuickViewModal';
import { FeaturedDealsCarousel } from '@/components/marketplace/FeaturedDealsCarousel';
import { ActiveFiltersBar, ActiveFilter } from '@/components/marketplace/ActiveFiltersBar';
import { InquiryModal } from '@/components/deals/InquiryModal';
import { CompareDrawer } from '@/components/deals/CompareDrawer';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { getCallerTypeSync } from '@/hooks/useCallerType';

import { SkipLinks, LiveRegion } from '@/hooks/useAccessibility';
import { resolvePublicPhotoUrl } from '@/utils/photoUtils';

import { 
  Building2, Loader2, LayoutGrid, List, RefreshCw, Filter, X, 
  ChevronLeft, ChevronRight, BarChart3, ArrowUpDown, SlidersHorizontal,
  TrendingUp, Shield, Clock, Users, Briefcase, Star, MapPin, Heart, LogIn
} from 'lucide-react';


interface Property {
  id: string;
  listing_title: string;
  city: string;
  state: string;
  zip_code: string;
  bedrooms: number;
  bathrooms: number;
  square_feet?: number;
  sqft?: number;

  monthly_rent: number;
  acquisition_fee: number;
  is_furnished: boolean;
  is_verified: boolean;
  staff_verified?: boolean;
  operation_type: string;
  property_type: string;
  description: string;
  created_at: string;
  is_featured?: boolean;
  photos?: string[];
  penny_score?: number;
  penny_recommendation?: string;
  source?: string;
}

interface PropertyAnalytics {
  property_id: string;
  str_average_daily_rate: number;
  str_occupancy_rate: number;
  str_projected_yearly_revenue: number;
  str_viability_score: number;
  coliving_per_room_rate: number;
  coliving_projected_yearly_revenue: number;
  coliving_viability_score: number;
}


const ITEMS_PER_PAGE = 24;

const CATEGORY_TABS = [
  { id: 'all', label: 'All Deals', icon: Building2 },
  { id: 'str', label: 'Short-Term Rental', icon: Building2 },
  { id: 'coliving', label: 'Co-Living', icon: Users },
  { id: 'both', label: 'STR + Co-Living', icon: Star },
  { id: 'peerspace', label: 'Peer Space', icon: Briefcase },
];

const OPERATION_TYPE_LABELS: Record<string, string> = {
  str: 'Short-Term Rental',
  coliving: 'Co-Living',
  both: 'STR + Co-Living',
  peerspace: 'Peer Space',
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  single_family: 'Single Family',
  apartment: 'Apartment',
  condo: 'Condo',
  townhouse: 'Townhouse',
  multi_family: 'Multi-Family',
  duplex: 'Duplex',
};

const defaultFilters: MarketplaceFiltersState = {
  operationType: [],
  propertyType: [],
  priceRange: [0, 50000],
  bedroomRange: [0, 10],
  bathroomRange: [0, 10],
  furnished: null,
  verified: null,
  states: [],
};

export default function Deals() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, PropertyAnalytics>>({});
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Tick every 30s so the "Last updated Xm ago" label stays current without refetching
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  
  // Unified filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [filters, setFilters] = useState<MarketplaceFiltersState>(defaultFilters);
  const [sortBy, setSortBy] = useState('newest');
  const [showFilters, setShowFilters] = useState(true);
  
  // View & Pagination
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Modals
  const [selectedDeal, setSelectedDeal] = useState<Property | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  
  // Compare
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  
  // Saved deals - connected to investor auth
  const [savedDeals, setSavedDeals] = useState<string[]>([]);
  const [investorSession, setInvestorSession] = useState<any>(null);
  const [savingDealId, setSavingDealId] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Check for investor session on mount
  useEffect(() => {
    const stored = localStorage.getItem('investorSession');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const sessionAge = Date.now() - (parsed.loginTime || 0);
        const rememberMe = localStorage.getItem('investorRememberMe') === 'true';
        const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
        
        if (sessionAge < maxAge) {
          setInvestorSession(parsed);
        }
      } catch (e) {
        console.error('Error parsing investor session:', e);
      }
    }
  }, []);

  // Load saved deals from investor_favorites when investor is logged in
  useEffect(() => {
    if (investorSession?.id) {
      loadSavedDeals(investorSession.id);
    }
  }, [investorSession?.id]);


  useEffect(() => {
    fetchDeals();
  }, []);

  useEffect(() => {
    if (!loading && properties.length > 0) {
      const count = filteredProperties.length;
      setAnnouncement(`Showing ${count} ${count === 1 ? 'property' : 'properties'}`);
    }
  }, [activeCategory, filters, sortBy, searchQuery, loading]);

  // Smooth transition when filters change
  const triggerTransition = useCallback(() => {
    setIsTransitioning(true);
    setCurrentPage(1);
    setTimeout(() => setIsTransitioning(false), 300);
  }, []);

  // Helper: race a promise against a timeout so slow/hung edge functions don't
  // block the marketplace from rendering on mobile or flaky networks.
  const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`[Deals] ${label} timed out after ${ms}ms`));
      }, ms);
      promise.then(
        (val) => { clearTimeout(timer); resolve(val); },
        (err) => { clearTimeout(timer); reject(err); }
      );
    });
  };

  // Direct REST fetch fallback — uses the anon key directly instead of the
  // supabase-js client. This runs when the edge function is empty/down and
  // gives us a resilient second path to data.
  //
  // IMPORTANT: we use a BLACKLIST (status NOT IN draft/new_lead/archived/...)
  // rather than a strict whitelist (is_published=true / status in approved).
  // Reason: existing production rows don't consistently have is_published=true
  // or status='published' set — many legit deals have status=null, status
  // = 'for_sale', 'listed', 'active_listing', etc. A strict whitelist would
  // return 0 rows (what we were hitting). A blacklist reliably hides drafts
  // and internal-only rows while keeping every legit listing visible.
  const fetchPropertiesViaRest = async (signal: AbortSignal): Promise<Property[] | null> => {
    const SUPABASE_URL = 'https://zhobqrmkbtsqugtiahyn.databasepad.com';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjE5NzdmNTg3LWRiYzAtNDMwNi05YTIwLTEwNDg1OGU5NGUxMyJ9.eyJwcm9qZWN0SWQiOiJ6aG9icXJta2J0c3F1Z3RpYWh5biIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzYyODI4OTQ4LCJleHAiOjIwNzgxODg5NDgsImlzcyI6ImZhbW91cy5kYXRhYmFzZXBhZCIsImF1ZCI6ImZhbW91cy5jbGllbnRzIn0.2U5bzJ9__u_Ae4PPUPQzI8wEpdIXbr_IqQy2UhOzqAI';

    // Blacklist hidden statuses. `status.is.null` keeps legacy rows with no
    // status value visible. Also keep rows that are explicitly published OR
    // have workflow_stage='published' OR have is_published=true — this way
    // we catch every "visible" shape the data can take.
    const filter = [
      'or=(',
      [
        'is_published.eq.true',
        'workflow_stage.eq.published',
        'status.is.null',
        'status.not.in.(draft,new_lead,archived,rejected,deleted,pending_review,internal_only)',
      ].join(','),
      ')',
    ].join('');
    const url = `${SUPABASE_URL}/rest/v1/properties?${filter}&order=is_featured.desc.nullsfirst,created_at.desc&limit=500`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      signal,
    });

    if (!res.ok) {
      console.warn('[Deals] REST fallback returned non-OK:', res.status, await res.text().catch(() => ''));
      return null;
    }

    const rows = await res.json();
    if (!Array.isArray(rows)) return null;

    // Strip sensitive fields client-side for non-staff callers
    return rows.map((p: any) => ({
      ...p,
      landlord_name: null,
      landlord_email: null,
      landlord_phone: null,
      internal_notes: null,
      community_name: null,
      address: null,
    }));
  };

  // Client-side safety filter: used on any code path that might include
  // drafts (Strategy 3 unfiltered DB fallback). Mirrors the REST blacklist so
  // the UI never shows obviously-private rows even if the server returns them.
  const HIDDEN_STATUSES = new Set([
    'draft',
    'new_lead',
    'archived',
    'rejected',
    'deleted',
    'pending_review',
    'internal_only',
  ]);
  const isVisibleToPublic = (p: any): boolean => {
    // Explicit publish signals always win
    if (p?.is_published === true) return true;
    if (p?.workflow_stage === 'published') return true;
    // Otherwise hide rows with a blacklisted status
    const status = (p?.status || '').toString().toLowerCase();
    if (!status) return true; // legacy / null-status rows are visible
    return !HIDDEN_STATUSES.has(status);
  };


  const fetchDeals = async () => {
    setLoading(true);
    setError(null);

    // Determine caller_type for visibility filtering
    const { callerType: resolvedCallerType } = getCallerTypeSync();
    console.log('[Deals] ▶ fetchDeals starting. caller_type=', resolvedCallerType);

    // Hard safety timer: no matter what happens with any of the 3 strategies,
    // NEVER leave the user stuck on the "Loading marketplace..." spinner. If
    // we haven't resolved in 25s, force loading=false and surface an error so
    // the user can retry.
    const hardStopTimer = setTimeout(() => {
      console.warn('[Deals] ⏱ Hard-stop timer (25s) fired — forcing loading=false');
      setLoading((stillLoading) => {
        if (stillLoading) {
          setError('Marketplace is taking longer than expected to load. Please refresh to try again.');
          setLastUpdated(new Date());
          return false;
        }
        return stillLoading;
      });
    }, 25000);

    try {
      let propertiesData: Property[] | null = null;
      let sourceStrategy = '';

      // ========================================================================
      // Strategy 1 (PRIMARY): Direct REST API call with blacklist publish filter.
      // We've moved REST to Strategy 1 because it's the simplest, fastest, and
      // most reliable path — no supabase-js client overhead, no cold-start
      // edge-function delay, no middleware surprises. This matches exactly what
      // the get-properties v5.2 edge function does server-side, so results are
      // identical.
      // ========================================================================
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        console.log('[Deals] Strategy 1 (REST) starting...');
        const restRows = await fetchPropertiesViaRest(controller.signal);
        clearTimeout(timeoutId);
        if (restRows && restRows.length > 0) {
          propertiesData = restRows;
          sourceStrategy = 'REST';
          console.log(`[Deals] ✓ Strategy 1 (REST) success: ${restRows.length} properties`);
        } else {
          console.warn('[Deals] Strategy 1 (REST) returned no rows (array length=0 or null)');
        }
      } catch (restErr: any) {
        console.warn('[Deals] Strategy 1 (REST) failed:', restErr?.message || restErr);
      }

      // ========================================================================
      // Strategy 2 (FALLBACK): get-properties edge function. Used when the
      // direct REST call fails (e.g. CORS, network, or anon-key issues).
      // ========================================================================
      if (!propertiesData || propertiesData.length === 0) {
        try {
          console.log('[Deals] Strategy 2 (edge function) starting...');
          const efPromise = supabase.functions.invoke('get-properties', {
            body: {
              limit: 500,
              include_all: false,
              caller_type: resolvedCallerType,
              caller_investor_id: investorSession?.id || null
            }
          });

          const { data: efData, error: efError } = await withTimeout(
            efPromise as any,
            15000,
            'get-properties edge function'
          );

          if (efError) {
            console.warn('[Deals] Strategy 2 edge function error:', efError);
          } else if (efData?.properties && Array.isArray(efData.properties) && efData.properties.length > 0) {
            propertiesData = efData.properties;
            sourceStrategy = 'edge-function';
            console.log(`[Deals] ✓ Strategy 2 (edge function) success: ${efData.properties.length} properties`);
          } else {
            console.warn('[Deals] Strategy 2 edge function returned empty or malformed payload. Raw:', efData);
          }
        } catch (efErr: any) {
          console.warn('[Deals] Strategy 2 edge function failed or timed out:', efErr?.message || efErr);
        }
      }

      // ========================================================================
      // Strategy 3 (LAST RESORT): supabase-js unfiltered DB query, then apply
      // the public-visibility blacklist client-side.
      // ========================================================================
      if (!propertiesData || propertiesData.length === 0) {
        try {
          console.log('[Deals] Strategy 3 (supabase-js DB query) starting...');
          const fallbackPromise = supabase
            .from('properties')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500);

          const { data: fallbackData, error: fallbackError } = await withTimeout(
            fallbackPromise as any,
            10000,
            'properties fallback DB query'
          );

          if (!fallbackError && fallbackData?.length) {
            const visibleRows = (fallbackData as any[]).filter(isVisibleToPublic);
            propertiesData = visibleRows.map((p: any) => ({
              ...p,
              landlord_name: null,
              landlord_email: null,
              landlord_phone: null,
              internal_notes: null,
              community_name: null,
              address: null,
            }));
            sourceStrategy = 'supabase-js';
            console.log(
              `[Deals] ✓ Strategy 3 success: ${fallbackData.length} raw rows, ${visibleRows.length} after public-visibility filter`
            );
          } else if (fallbackError) {
            console.warn('[Deals] Strategy 3 DB error:', fallbackError.message);
          }
        } catch (dbErr: any) {
          console.warn('[Deals] Strategy 3 DB fallback failed or timed out:', dbErr?.message || dbErr);
        }
      }

      // Always clear the hard-stop timer — we got past the fetch phase.
      clearTimeout(hardStopTimer);

      if (propertiesData && propertiesData.length > 0) {
        console.log(`[Deals] ✅ RESOLVED via ${sourceStrategy} with ${propertiesData.length} properties`);

        // Normalize fields so UI rendering is consistent.
        const toNum = (v: any): any => {
          if (v === null || v === undefined || v === '') return v;
          const n = typeof v === 'number' ? v : Number(v);
          return Number.isFinite(n) ? n : v;
        };
        propertiesData = propertiesData.map((p: any) => ({
          ...p,
          operation_type: (p.operation_type || 'str').toString().toLowerCase(),
          monthly_rent: toNum(p.monthly_rent),
          acquisition_fee: toNum(p.acquisition_fee),
          bedrooms: toNum(p.bedrooms),
          bathrooms: toNum(p.bathrooms),
          sqft: toNum(p.sqft),
          square_feet: toNum(p.square_feet),
        }));

        // CRITICAL: render immediately so users see cards on first paint.
        // Analytics + missing-photo enrichment run in the background below.
        setProperties(propertiesData);
        setLoading(false);
        setLastUpdated(new Date());

        const propertyIds = propertiesData.map(p => p.id);

        // Seed the photos map from the inline properties.photos column so the
        // cards have imagery immediately on first paint.
        const photosMap: Record<string, string[]> = {};
        propertiesData.forEach(property => {
          if (property.photos && Array.isArray(property.photos) && property.photos.length > 0) {
            const validPhotos = property.photos
              .filter((url: string) => url && url.trim().length > 0 && url !== 'null')
              .map((url: string) => {
                const trimmed = url.trim();
                if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                  return trimmed;
                }
                return resolvePublicPhotoUrl(trimmed);
              });
            if (validPhotos.length > 0) {
              photosMap[property.id] = validPhotos;
            }
          }
        });
        setPhotos(photosMap);

        // Fire analytics + missing-photo queries in PARALLEL, non-blocking.
        const analyticsPromise = supabase
          .from('deal_analytics')
          .select('property_id, str_average_daily_rate, str_occupancy_rate, str_projected_yearly_revenue, str_viability_score, coliving_per_room_rate, coliving_projected_yearly_revenue, coliving_viability_score')
          .in('property_id', propertyIds)
          .then(({ data: analyticsData }) => {
            if (analyticsData) {
              const analyticsMap: Record<string, PropertyAnalytics> = {};
              analyticsData.forEach(a => { analyticsMap[a.property_id] = a; });
              setAnalytics(analyticsMap);
            }
          })
          .catch(e => console.warn('[Deals] Analytics query failed:', e));

        const missingPhotoIds = propertiesData
          .filter(p => !photosMap[p.id] || photosMap[p.id].length === 0)
          .map(p => p.id);

        const photosPromise = missingPhotoIds.length > 0
          ? supabase
              .from('property_photos')
              .select('property_id, original_url, processed_url, thumbnail_url, display_order')
              .in('property_id', missingPhotoIds)
              .order('display_order', { ascending: true })
              .then(({ data: photosTableData }) => {
                if (photosTableData && photosTableData.length > 0) {
                  setPhotos(prev => {
                    const next = { ...prev };
                    photosTableData.forEach(photo => {
                      if (!next[photo.property_id]) next[photo.property_id] = [];
                      const rawUrl = photo.processed_url || photo.original_url;
                      if (rawUrl) {
                        next[photo.property_id] = [...next[photo.property_id], resolvePublicPhotoUrl(rawUrl)];
                      }
                    });
                    return next;
                  });
                  console.log(`[Deals] property_photos table provided photos for ${new Set(photosTableData.map(p => p.property_id)).size} properties`);
                }
              })
              .catch(e => console.warn('[Deals] property_photos table query failed:', e))
          : Promise.resolve();

        Promise.all([analyticsPromise, photosPromise]).then(() => {
          console.log('[Deals] Background enrichment complete');
        });
      } else {
        console.warn('[Deals] ❌ No properties found from any strategy — rendering empty state');
        setProperties([]);
        setLoading(false);
        setLastUpdated(new Date());
      }

    } catch (err: any) {
      clearTimeout(hardStopTimer);
      console.error('[Deals] Fatal error in fetchDeals:', err);
      setError(err?.message || 'Failed to load properties');
      setLoading(false);
    }
  };






  const availableLocations = useMemo(() => {
    const locations = new Set<string>();
    properties.forEach(p => {
      if (p.state) locations.add(p.state);
    });
    return Array.from(locations).sort();
  }, [properties]);

  // Unified filter logic - category tabs and sidebar work together, not against each other
  const filteredProperties = useMemo(() => {
    let result = [...properties];

    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.city?.toLowerCase().includes(searchLower) ||
        p.state?.toLowerCase().includes(searchLower) ||
        p.zip_code?.includes(searchQuery) ||
        p.listing_title?.toLowerCase().includes(searchLower)
      );
    }

    // Location filter (from header dropdown)
    if (selectedLocation) {
      result = result.filter(p => p.state === selectedLocation);
    }

    // UNIFIED operation type filter:
    // If sidebar operationType is set, it takes priority (more specific)
    // If only category tab is set, use that
    // They don't conflict because selecting a category clears sidebar operationType
    // and selecting sidebar operationType syncs the category tab
    if (filters.operationType.length > 0) {
      result = result.filter(p => filters.operationType.includes(p.operation_type || 'str'));
    } else if (activeCategory !== 'all') {
      result = result.filter(p => (p.operation_type || 'str') === activeCategory);
    }

    // Property type filter
    if (filters.propertyType.length > 0) {
      result = result.filter(p => filters.propertyType.includes(p.property_type));
    }

    // Price range filter
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 50000) {
      result = result.filter(p => {
        const fee = p.acquisition_fee || 0;
        return fee >= filters.priceRange[0] && fee <= filters.priceRange[1];
      });
    }

    // Bedroom filter
    if (filters.bedroomRange[0] > 0 || filters.bedroomRange[1] < 10) {
      result = result.filter(p => {
        const beds = p.bedrooms || 0;
        return beds >= filters.bedroomRange[0] && beds <= filters.bedroomRange[1];
      });
    }

    // Furnished filter
    if (filters.furnished !== null) {
      result = result.filter(p => p.is_furnished === filters.furnished);
    }

    // Verified filter
    if (filters.verified !== null) {
      result = result.filter(p => p.is_verified === filters.verified);
    }

    // State filter (from sidebar)
    if (filters.states.length > 0) {
      result = result.filter(p => filters.states.includes(p.state));
    }

    // Sorting
    switch (sortBy) {
      case 'price_low':
        result.sort((a, b) => (a.acquisition_fee || 0) - (b.acquisition_fee || 0));
        break;
      case 'price_high':
        result.sort((a, b) => (b.acquisition_fee || 0) - (a.acquisition_fee || 0));
        break;
      case 'viability':
        result.sort((a, b) => {
          const aScore = Math.max(analytics[a.id]?.str_viability_score || 0, analytics[a.id]?.coliving_viability_score || 0);
          const bScore = Math.max(analytics[b.id]?.str_viability_score || 0, analytics[b.id]?.coliving_viability_score || 0);
          return bScore - aScore;
        });
        break;
      case 'bedrooms':
        result.sort((a, b) => (b.bedrooms || 0) - (a.bedrooms || 0));
        break;
      case 'newest':
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [properties, searchQuery, selectedLocation, activeCategory, filters, sortBy, analytics]);

  // Pagination
  const totalPages = Math.ceil(filteredProperties.length / ITEMS_PER_PAGE);
  const paginatedProperties = filteredProperties.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Featured deals
  const featuredDeals = useMemo(() => {
    return properties
      .filter(p => p.is_featured || p.is_verified)
      .slice(0, 5)
      .map(p => ({
        ...p,
        photos: photos[p.id]?.length ? photos[p.id] : (p.photos || []).map(url => resolvePublicPhotoUrl(url)),
        analytics: analytics[p.id]
      }));
  }, [properties, analytics, photos]);

  // Category counts - count from ALL properties (not filtered)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: properties.length,
      str: properties.filter(p => (p.operation_type || 'str') === 'str').length,
      coliving: properties.filter(p => p.operation_type === 'coliving').length,
      both: properties.filter(p => p.operation_type === 'both').length,
      peerspace: properties.filter(p => p.operation_type === 'peerspace').length,
    };
    return counts;
  }, [properties]);

  // Build active filters list for the chips bar
  const activeFiltersList = useMemo((): ActiveFilter[] => {
    const list: ActiveFilter[] = [];

    if (searchQuery) {
      list.push({ key: 'search', label: 'Search', value: searchQuery, displayValue: `"${searchQuery}"` });
    }

    if (selectedLocation) {
      list.push({ key: 'location', label: 'Location', value: selectedLocation, displayValue: selectedLocation });
    }

    if (activeCategory !== 'all' && filters.operationType.length === 0) {
      list.push({ 
        key: 'category', 
        label: 'Category', 
        value: activeCategory, 
        displayValue: OPERATION_TYPE_LABELS[activeCategory] || activeCategory 
      });
    }

    filters.operationType.forEach(type => {
      list.push({ 
        key: 'operationType', 
        label: 'Type', 
        value: type, 
        displayValue: OPERATION_TYPE_LABELS[type] || type 
      });
    });

    filters.propertyType.forEach(type => {
      list.push({ 
        key: 'propertyType', 
        label: 'Property', 
        value: type, 
        displayValue: PROPERTY_TYPE_LABELS[type] || type 
      });
    });

    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 50000) {
      list.push({ 
        key: 'priceRange', 
        label: 'Price', 
        value: 'range', 
        displayValue: `$${filters.priceRange[0].toLocaleString()} - $${filters.priceRange[1].toLocaleString()}${filters.priceRange[1] >= 50000 ? '+' : ''}` 
      });
    }

    if (filters.bedroomRange[0] > 0 || filters.bedroomRange[1] < 10) {
      list.push({ 
        key: 'bedroomRange', 
        label: 'Beds', 
        value: 'range', 
        displayValue: filters.bedroomRange[0] === filters.bedroomRange[1] 
          ? `${filters.bedroomRange[0]} bed` 
          : `${filters.bedroomRange[0]}-${filters.bedroomRange[1]} beds` 
      });
    }

    if (filters.furnished !== null) {
      list.push({ key: 'furnished', label: 'Feature', value: 'furnished', displayValue: 'Furnished' });
    }

    if (filters.verified !== null) {
      list.push({ key: 'verified', label: 'Feature', value: 'verified', displayValue: 'YP Verified' });
    }

    filters.states.forEach(state => {
      list.push({ key: 'states', label: 'State', value: state, displayValue: state });
    });

    return list;
  }, [searchQuery, selectedLocation, activeCategory, filters]);

  const hasActiveFilters = activeFiltersList.length > 0;

  // Handle removing a single filter chip
  const handleRemoveFilter = useCallback((key: string, value: string) => {
    triggerTransition();
    
    switch (key) {
      case 'search':
        setSearchQuery('');
        break;
      case 'location':
        setSelectedLocation('');
        break;
      case 'category':
        setActiveCategory('all');
        break;
      case 'operationType':
        setFilters(prev => ({ ...prev, operationType: prev.operationType.filter(t => t !== value) }));
        break;
      case 'propertyType':
        setFilters(prev => ({ ...prev, propertyType: prev.propertyType.filter(t => t !== value) }));
        break;
      case 'priceRange':
        setFilters(prev => ({ ...prev, priceRange: [0, 50000] }));
        break;
      case 'bedroomRange':
        setFilters(prev => ({ ...prev, bedroomRange: [0, 10] }));
        break;
      case 'furnished':
        setFilters(prev => ({ ...prev, furnished: null }));
        break;
      case 'verified':
        setFilters(prev => ({ ...prev, verified: null }));
        break;
      case 'states':
        setFilters(prev => ({ ...prev, states: prev.states.filter(s => s !== value) }));
        break;
    }
  }, [triggerTransition]);

  const clearAllFilters = useCallback(() => {
    triggerTransition();
    setFilters(defaultFilters);
    setSearchQuery('');
    setSelectedLocation('');
    setActiveCategory('all');
  }, [triggerTransition]);

  // Handle category tab click - sync with sidebar
  const handleCategoryChange = useCallback((categoryId: string) => {
    triggerTransition();
    setActiveCategory(categoryId);
    // Clear sidebar operation type to avoid conflicts
    if (categoryId !== 'all') {
      setFilters(prev => ({ ...prev, operationType: [] }));
    }
  }, [triggerTransition]);

  // Handle sidebar filter change - sync with category tabs
  const handleFiltersChange = useCallback((newFilters: MarketplaceFiltersState) => {
    triggerTransition();
    setFilters(newFilters);
    // If user selects operation types in sidebar, sync category tab
    if (newFilters.operationType.length === 1) {
      setActiveCategory(newFilters.operationType[0]);
    } else if (newFilters.operationType.length > 1 || newFilters.operationType.length === 0) {
      setActiveCategory('all');
    }
  }, [triggerTransition]);

  const handleViewDetails = (deal: Property) => {
    setSelectedDeal(deal);
    setQuickViewOpen(true);
  };

  const handleInquire = (deal: Property) => {
    setSelectedDeal(deal);
    setInquiryOpen(true);
  };

  // Load saved deals from investor_favorites edge function
  const loadSavedDeals = async (investorId: string) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('investor-favorites', {
        body: { action: 'list', investor_id: investorId }
      });
      if (!fnError && data?.favorites) {
        const ids = data.favorites.map((f: any) => f.property_id).filter(Boolean);
        setSavedDeals(ids);
        console.log('[Deals] Loaded', ids.length, 'saved deals for investor', investorId);
      }
    } catch (err) {
      console.error('[Deals] Error loading saved deals:', err);
    }
  };

  const handleToggleSave = async (id: string) => {
    // If not authenticated, show login prompt
    if (!investorSession?.id) {
      setLoginPromptOpen(true);
      return;
    }

    const isSaved = savedDeals.includes(id);
    setSavingDealId(id);

    // Optimistic update
    setSavedDeals(prev => 
      isSaved ? prev.filter(i => i !== id) : [...prev, id]
    );

    try {
      const { data, error: fnError } = await supabase.functions.invoke('investor-favorites', {
        body: { 
          action: isSaved ? 'remove' : 'add', 
          investor_id: investorSession.id, 
          property_id: id 
        }
      });

      if (fnError || data?.error) {
        // Revert optimistic update
        setSavedDeals(prev => 
          isSaved ? [...prev, id] : prev.filter(i => i !== id)
        );
        toast({
          title: 'Error',
          description: 'Failed to save deal. Please try again.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: isSaved ? 'Removed from saved' : 'Deal saved!',
          description: isSaved 
            ? 'Deal removed from your saved list' 
            : 'Deal saved to your investor portal. View it in your Saved Deals tab.',
        });
      }
    } catch (err) {
      // Revert optimistic update
      setSavedDeals(prev => 
        isSaved ? [...prev, id] : prev.filter(i => i !== id)
      );
      console.error('[Deals] Error toggling save:', err);
      toast({
        title: 'Error',
        description: 'Failed to save deal. Please try again.',
        variant: 'destructive'
      });
    }
    setSavingDealId(null);
  };


  const handleToggleCompare = (id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      }
      if (prev.length >= 3) {
        toast({
          title: 'Compare Limit',
          description: 'You can compare up to 3 properties at a time',
          variant: 'destructive'
        });
        return prev;
      }
      return [...prev, id];
    });
  };

  const compareProperties = properties.filter(p => compareIds.includes(p.id));

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Marketplace', url: '/deals' }
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO 
        title="Rental Arbitrage Marketplace - Pre-Negotiated Investment Deals"
        description={`Browse ${properties.length} verified rental arbitrage properties with landlord approval. Find STR, co-living, and peer space investment opportunities across ${availableLocations.length} states.`}
        keywords="rental arbitrage deals, STR properties for sale, co-living investment, Airbnb arbitrage, pre-approved rental properties"
        canonicalUrl="/deals"
        ogType="website"
        structuredData={breadcrumbSchema}
      />
      <SkipLinks />
      <LiveRegion message={announcement} />
      <Header />
      
      <main id="main-content" className="pt-20" role="main">
        {/* Marketplace Header */}
        <MarketplaceHeader
          totalDeals={properties.length}
          totalStates={availableLocations.length}
          searchQuery={searchQuery}
          onSearchChange={(q) => { setSearchQuery(q); triggerTransition(); }}
          onSearch={() => triggerTransition()}
          selectedLocation={selectedLocation}
          onLocationChange={(loc) => { setSelectedLocation(loc); triggerTransition(); }}
          locations={availableLocations}
        />

        {/* Main Content */}
        <div className="max-w-[1600px] mx-auto px-4 py-8">
          {/* Featured Deals */}
          {featuredDeals.length > 0 && !hasActiveFilters && (
            <div className="mb-8">
              <FeaturedDealsCarousel
                deals={featuredDeals}
                onViewDeal={(deal) => handleViewDetails(deal as Property)}
              />
            </div>
          )}

          {/* Category Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              {CATEGORY_TABS.map(cat => (
                <Button
                  key={cat.id}
                  variant={activeCategory === cat.id ? 'default' : 'ghost'}
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`transition-all duration-200 ${activeCategory === cat.id ? 'bg-[#1a365d] hover:bg-[#2d4a7c] shadow-md' : 'hover:bg-gray-100'}`}
                >
                  <cat.icon className="w-4 h-4 mr-2" />
                  {cat.label}
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {categoryCounts[cat.id] || 0}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>

          {/* Active Filters Bar */}
          <ActiveFiltersBar
            filters={activeFiltersList}
            resultCount={filteredProperties.length}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={clearAllFilters}
          />

          <div className="flex gap-6">
            {/* Filters Sidebar */}
            {showFilters && (
              <aside className="hidden lg:block w-72 flex-shrink-0">
                <div className="sticky top-24">
                  <MarketplaceFilters
                    filters={filters}
                    onFiltersChange={handleFiltersChange}
                    availableStates={availableLocations}
                    resultCount={filteredProperties.length}
                    onClearFilters={clearAllFilters}
                  />
                </div>
              </aside>
            )}

            {/* Results Area */}
            <div className="flex-1 min-w-0">
              {/* Published Deals Counter — uses the server-side publish-filtered count
                  (properties.length) from the get-properties edge function so investors
                  know exactly how many deals are live. Includes a refresh button and
                  last-updated timestamp so the data feels live and auditable. */}
              {!loading && !error && (() => {
                // "Time ago" formatter. Re-reads nowTick so the label updates without
                // a refetch every 30s (see setInterval at top of component).
                void nowTick;
                let timeAgo = 'just now';
                if (lastUpdated) {
                  const diffSec = Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
                  if (diffSec < 10) timeAgo = 'just now';
                  else if (diffSec < 60) timeAgo = `${diffSec}s ago`;
                  else if (diffSec < 3600) timeAgo = `${Math.floor(diffSec / 60)}m ago`;
                  else if (diffSec < 86400) timeAgo = `${Math.floor(diffSec / 3600)}h ago`;
                  else timeAgo = lastUpdated.toLocaleDateString();
                }
                const exactTimestamp = lastUpdated
                  ? lastUpdated.toLocaleString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                      second: '2-digit',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '';

                return (
                  <div className="bg-gradient-to-r from-emerald-50 via-white to-white border border-emerald-100 rounded-xl p-4 mb-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Live indicator dot */}
                        <div className="relative flex-shrink-0">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-75" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base text-gray-700 font-medium">
                            Showing{' '}
                            <span className="font-bold text-[#1a365d]">
                              {filteredProperties.length.toLocaleString()}
                            </span>{' '}
                            of{' '}
                            <span className="font-bold text-[#1a365d]">
                              {properties.length.toLocaleString()}
                            </span>{' '}
                            published {properties.length === 1 ? 'deal' : 'deals'}
                            {hasActiveFilters && (
                              <span className="ml-2 text-xs font-normal text-gray-500">
                                (filters applied)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                            <Clock className="w-3 h-3 flex-shrink-0" />
                            <span title={exactTimestamp}>
                              Last updated {timeAgo}
                              {exactTimestamp && (
                                <span className="hidden sm:inline text-gray-400"> · {exactTimestamp}</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchDeals}
                        disabled={loading}
                        aria-label="Refresh deals list"
                        title="Refresh deals list"
                        className="flex-shrink-0 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 text-[#1a365d]"
                      >
                        <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                      </Button>
                    </div>
                  </div>
                );
              })()}

              {/* Toolbar */}

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                      className="lg:hidden"
                    >
                      <SlidersHorizontal className="w-4 h-4 mr-2" />
                      Filters
                    </Button>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        <span className="font-bold text-lg text-[#1a365d]">{filteredProperties.length.toLocaleString()}</span>
                        <span className="ml-1">deals found</span>
                      </span>
                    </div>

                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                        <X className="w-4 h-4 mr-1" />
                        Clear all
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Sort */}
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-[180px]">
                        <ArrowUpDown className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest First</SelectItem>
                        <SelectItem value="price_low">Price: Low to High</SelectItem>
                        <SelectItem value="price_high">Price: High to Low</SelectItem>
                        <SelectItem value="viability">Viability Score</SelectItem>
                        <SelectItem value="bedrooms">Most Bedrooms</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* View Toggle */}
                    <div className="flex border rounded-lg overflow-hidden">
                      <Button
                        variant={viewMode === 'grid' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('grid')}
                        className={viewMode === 'grid' ? 'bg-[#d4a574] hover:bg-[#c49464]' : ''}
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'list' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                        className={viewMode === 'list' ? 'bg-[#d4a574] hover:bg-[#c49464]' : ''}
                      >
                        <List className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Refresh */}
                    <Button variant="outline" size="sm" onClick={fetchDeals}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Compare Bar */}
                {compareIds.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {compareIds.length} properties selected for comparison
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCompareIds([])}>
                        Clear
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => setCompareOpen(true)}
                        className="bg-[#1a365d] hover:bg-[#2d4a7c]"
                      >
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Compare ({compareIds.length})
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Results */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-12 h-12 text-[#d4a574] animate-spin mb-4" />
                  <p className="text-gray-600 font-medium">Loading marketplace...</p>
                </div>
              ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
                  <p className="text-red-600 mb-4">{error}</p>
                  <Button onClick={fetchDeals} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              ) : paginatedProperties.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-br from-[#1a365d]/5 via-[#d4a574]/5 to-transparent p-12 text-center">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] rounded-2xl flex items-center justify-center shadow-lg">
                      <Building2 className="w-12 h-12 text-[#d4a574]" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">
                      {properties.length === 0 ? 'No Properties Available' : 'No Matches Found'}
                    </h3>
                    <p className="text-gray-600 max-w-lg mx-auto mb-4">
                      {properties.length === 0 
                        ? "We're actively sourcing new rental arbitrage opportunities. Check back soon!"
                        : "Try adjusting your filters or search criteria to see more properties."}
                    </p>
                    {hasActiveFilters && (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-500">
                          You have {activeFiltersList.length} active filter{activeFiltersList.length !== 1 ? 's' : ''} applied
                        </p>
                        <Button onClick={clearAllFilters} className="bg-[#d4a574] hover:bg-[#c49464]">
                          <Filter className="w-5 h-5 mr-2" />
                          Clear All Filters
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Property Grid/List with smooth transitions */}
                  <div 
                    className={`transition-all duration-300 ease-in-out ${
                      isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
                    }`}
                  >
                    <div className={viewMode === 'grid' 
                      ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' 
                      : 'space-y-4'
                    }>
                      {paginatedProperties.map((property, index) => (
                        <div
                          key={property.id}
                          className="animate-in fade-in slide-in-from-bottom-4"
                          style={{ animationDelay: `${index * 50}ms`, animationDuration: '400ms', animationFillMode: 'both' }}
                        >
                          <MarketplaceDealCard
                            deal={property}
                            analytics={analytics[property.id]}
                            photos={photos[property.id] || []}
                            onViewDetails={() => handleViewDetails(property)}
                            onSave={() => handleToggleSave(property.id)}
                            isSaved={savedDeals.includes(property.id)}
                            viewMode={viewMode}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); triggerTransition(); }}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => { setCurrentPage(pageNum); triggerTransition(); }}
                            className={currentPage === pageNum ? 'bg-[#d4a574] hover:bg-[#c49464]' : ''}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); triggerTransition(); }}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {/* Results Summary */}
                  <div className="mt-4 text-center text-sm text-gray-500">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredProperties.length)} of {filteredProperties.length.toLocaleString()} deals
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* CTA Section */}
        {!loading && properties.length > 0 && (
          <div className="bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] py-16 mt-12">
            <div className="max-w-4xl mx-auto px-4 text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to Start Your Investment Journey?
              </h2>
              <p className="text-white/80 text-lg mb-8">
                Create a free investor account to save deals, get personalized recommendations, and receive alerts for new opportunities.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button 
                  size="lg"
                  className="bg-[#d4a574] hover:bg-[#c49464] text-white px-8"
                  onClick={() => window.location.href = '/investor/login'}
                >
                  Create Free Account
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white/10 px-8"
                  onClick={() => window.location.href = '/pricing'}
                >
                  View Pricing
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
      
      <Footer />

      {/* Quick View Modal */}
      <QuickViewModal
        open={quickViewOpen}
        onClose={() => setQuickViewOpen(false)}
        deal={selectedDeal}
        analytics={selectedDeal ? analytics[selectedDeal.id] : undefined}
        photos={selectedDeal ? photos[selectedDeal.id] || [] : []}
        onInquire={() => {
          setQuickViewOpen(false);
          if (selectedDeal) handleInquire(selectedDeal);
        }}
        onSave={selectedDeal ? () => handleToggleSave(selectedDeal.id) : undefined}
        isSaved={selectedDeal ? savedDeals.includes(selectedDeal.id) : false}
      />

      {/* Inquiry Modal */}
      <InquiryModal
        open={inquiryOpen}
        onOpenChange={setInquiryOpen}
        deal={selectedDeal}
        onSubmitted={() => {
          toast({
            title: 'Inquiry Submitted',
            description: 'Our team will contact you within 24 hours.',
          });
        }}
      />

      {/* Compare Drawer */}
      <CompareDrawer
        open={compareOpen}
        onOpenChange={setCompareOpen}
        properties={compareProperties}
        analytics={analytics}
        photos={photos}
        onRemove={(id) => setCompareIds(prev => prev.filter(i => i !== id))}
      />

      {/* Login Prompt Modal - shown when unauthenticated user tries to save */}
      <Dialog open={loginPromptOpen} onOpenChange={setLoginPromptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#d4a574] to-[#c49464] flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
              Save Your Favorite Deals
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              Create a free investor account to save deals, track your favorites across sessions, and get personalized deal recommendations.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
              <Heart className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-900 text-sm">Save deals across devices</p>
                <p className="text-blue-700 text-xs">Your saved deals sync to your account and are available anywhere.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-emerald-900 text-sm">Get deal alerts</p>
                <p className="text-emerald-700 text-xs">Receive notifications when new deals match your preferences.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
              <Shield className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-purple-900 text-sm">Priority access</p>
                <p className="text-purple-700 text-xs">Verified investors get early access to new deals and full property details.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              className="w-full bg-[#d4a574] hover:bg-[#c49464] h-12 text-base"
              onClick={() => {
                setLoginPromptOpen(false);
                window.location.href = '/investor/login';
              }}
            >
              <LogIn className="w-5 h-5 mr-2" />
              Sign In / Create Account
            </Button>
            <Button 
              variant="ghost" 
              className="w-full text-gray-500"
              onClick={() => setLoginPromptOpen(false)}
            >
              Continue Browsing
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
