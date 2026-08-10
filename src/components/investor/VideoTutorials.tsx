import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import {
  Play, Clock, BookOpen, Search, ChevronRight, 
  Building2, CreditCard, FileText, MessageSquare,
  BarChart3, Shield, Briefcase, Store, Target,
  CheckCircle2, Star, Cloud, CloudOff, Loader2
} from 'lucide-react';

interface Tutorial {
  id: string;
  title: string;
  description: string;
  duration: string;
  category: string;
  icon: React.ReactNode;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  topics: string[];
  videoPlaceholder?: string;
}

const TUTORIALS: Tutorial[] = [
  {
    id: 'getting-started',
    title: 'Getting Started with Your Portal',
    description: 'A complete walkthrough of your operator portal, including navigation, dashboard widgets, and key features.',
    duration: '5:30',
    category: 'Getting Started',
    icon: <BookOpen className="w-5 h-5" />,
    difficulty: 'beginner',
    topics: ['Portal Navigation', 'Dashboard Overview', 'Quick Actions', 'Profile Setup']
  },
  {
    id: 'browsing-deals',
    title: 'How to Browse & Evaluate Deals',
    description: 'Learn how to browse active deals, understand property metrics, and use Penny AI for deal analysis.',
    duration: '8:15',
    category: 'Deal Flow',
    icon: <Building2 className="w-5 h-5" />,
    difficulty: 'beginner',
    topics: ['Deal Flow Page', 'Property Cards', 'Penny AI Scores', 'Saving Deals']
  },
  {
    id: 'deal-alerts',
    title: 'Setting Up Deal Alerts & Matching',
    description: 'Configure intelligent deal alerts so you never miss a property that matches your investment criteria.',
    duration: '4:45',
    category: 'Deal Flow',
    icon: <Target className="w-5 h-5" />,
    difficulty: 'beginner',
    topics: ['Alert Preferences', 'Location Filters', 'Price Ranges', 'AI Matching']
  },
  {
    id: 'funding-account',
    title: 'Funding Your Account & Unlocking Addresses',
    description: 'Step-by-step guide to funding your account, choosing tiers, and unlocking property addresses.',
    duration: '6:00',
    category: 'Payments',
    icon: <CreditCard className="w-5 h-5" />,
    difficulty: 'beginner',
    topics: ['Funding Tiers', 'Payment Process', 'Address Unlocking', 'Credits System']
  },
  {
    id: 'acquisition-process',
    title: 'The Acquisition Process Explained',
    description: 'Understand the 9-stage acquisition workflow from payment to property launch.',
    duration: '12:00',
    category: 'Acquisitions',
    icon: <Briefcase className="w-5 h-5" />,
    difficulty: 'intermediate',
    topics: ['9-Stage Workflow', 'Payment', 'Application', 'Lease Review', 'Setup & Launch']
  },
  {
    id: 'portfolio-management',
    title: 'Managing Your Portfolio',
    description: 'Track your properties, monitor performance, manage expenses, and forecast revenue.',
    duration: '10:30',
    category: 'Portfolio',
    icon: <BarChart3 className="w-5 h-5" />,
    difficulty: 'intermediate',
    topics: ['Property Tracking', 'Performance Metrics', 'Expense Management', 'Revenue Forecasting']
  },
  {
    id: 'marketplace',
    title: 'Using the Deal Marketplace',
    description: 'Learn how to buy and sell operations through our verified marketplace.',
    duration: '7:45',
    category: 'Marketplace',
    icon: <Store className="w-5 h-5" />,
    difficulty: 'intermediate',
    topics: ['Listing Operations', 'Verification Process', 'Making Offers', 'Transaction Fees']
  },
  {
    id: 'documents-signing',
    title: 'Documents & E-Signatures',
    description: 'How to manage documents, upload files, and complete e-signatures for your acquisitions.',
    duration: '4:00',
    category: 'Documents',
    icon: <FileText className="w-5 h-5" />,
    difficulty: 'beginner',
    topics: ['Document Upload', 'E-Signatures', 'File Management', 'Required Documents']
  },
  {
    id: 'messaging-team',
    title: 'Communicating with Your Team',
    description: 'Use the messaging system to communicate with your acquisition manager and setup manager.',
    duration: '3:30',
    category: 'Communication',
    icon: <MessageSquare className="w-5 h-5" />,
    difficulty: 'beginner',
    topics: ['Sending Messages', 'File Attachments', 'Response Times', 'Escalation']
  },
  {
    id: 'compliance-tos',
    title: 'Compliance & Terms of Service',
    description: 'Understanding platform rules, landlord outreach policies, and compliance requirements.',
    duration: '6:30',
    category: 'Compliance',
    icon: <Shield className="w-5 h-5" />,
    difficulty: 'advanced',
    topics: ['TOS Overview', 'Landlord Outreach Rules', 'Address Protection', 'Dispute Process']
  }
];

const CATEGORIES = ['All', 'Getting Started', 'Deal Flow', 'Payments', 'Acquisitions', 'Portfolio', 'Marketplace', 'Documents', 'Communication', 'Compliance'];

interface Props {
  investorId?: string;
}

export function VideoTutorials({ investorId }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
  const [watchedVideos, setWatchedVideos] = useState<string[]>([]);
  const [synced, setSynced] = useState(false);
  const [loading, setLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load watched status from DB with localStorage fallback
  useEffect(() => {
    const loadProgress = async () => {
      setLoading(true);
      
      // Load from localStorage first for instant display
      const localKey = investorId ? `watched_tutorials_${investorId}` : 'watched_tutorials';
      const stored = localStorage.getItem(localKey);
      let localWatched: string[] = stored ? JSON.parse(stored) : [];
      setWatchedVideos(localWatched);

      if (investorId) {
        try {
          const { data } = await supabase.functions.invoke('manage-investor-progress', {
            body: { action: 'get_tutorial_progress', investor_id: investorId }
          });

          if (data?.success && data.watched_tutorials) {
            const dbWatched: string[] = data.watched_tutorials;
            // Merge DB and local
            const merged = [...new Set([...dbWatched, ...localWatched])];
            setWatchedVideos(merged);
            localStorage.setItem(localKey, JSON.stringify(merged));
            
            // Sync back if there were new local items
            if (merged.length > dbWatched.length) {
              await saveToDB(merged);
            }
            setSynced(true);
          } else if (localWatched.length > 0) {
            // DB had no data, push local to DB
            await saveToDB(localWatched);
            setSynced(true);
          }
        } catch (err) {
          console.error('Failed to load tutorial progress from DB:', err);
        }
      }
      setLoading(false);
    };

    loadProgress();
  }, [investorId]);

  const saveToDB = async (items: string[]) => {
    if (!investorId) return;
    try {
      await supabase.functions.invoke('manage-investor-progress', {
        body: {
          action: 'update_tutorial_progress',
          investor_id: investorId,
          watched_tutorials: items
        }
      });
      setSynced(true);
    } catch (err) {
      console.error('Failed to save tutorial progress to DB:', err);
      setSynced(false);
    }
  };

  const markAsWatched = useCallback((id: string) => {
    setWatchedVideos(prev => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      
      // Save to localStorage immediately
      const localKey = investorId ? `watched_tutorials_${investorId}` : 'watched_tutorials';
      localStorage.setItem(localKey, JSON.stringify(updated));
      
      // Debounce DB save
      if (investorId) {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          saveToDB(updated);
        }, 1000);
      }
      
      return updated;
    });
  }, [investorId]);

  const filteredTutorials = TUTORIALS.filter(tutorial => {
    const matchesSearch = searchQuery === '' || 
      tutorial.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tutorial.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tutorial.topics.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || tutorial.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-700';
      case 'intermediate': return 'bg-blue-100 text-blue-700';
      case 'advanced': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const watchedCount = watchedVideos.length;
  const totalCount = TUTORIALS.length;
  const progressPercent = Math.round((watchedCount / totalCount) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#d4a574]/10 rounded-lg">
                <BookOpen className="w-6 h-6 text-[#d4a574]" />
              </div>
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  Video Tutorials & Help Center
                  {investorId && (
                    synced ? (
                      <Cloud className="w-4 h-4 text-green-500" title="Progress synced to cloud" />
                    ) : (
                      <CloudOff className="w-4 h-4 text-gray-400" title="Progress saved locally" />
                    )
                  )}
                </CardTitle>
                <CardDescription>
                  Learn how to use every feature of your operator portal
                </CardDescription>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">{watchedCount}/{totalCount} watched</p>
              <div className="w-32 h-2 bg-gray-200 rounded-full mt-1">
                <div 
                  className="h-full bg-[#d4a574] rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tutorials..."
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className={selectedCategory === cat ? 'bg-[#1a365d]' : ''}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Recommended for You */}
      {selectedCategory === 'All' && searchQuery === '' && (
        <Card className="bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] text-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-[#d4a574]" />
              Recommended for New Investors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-3">
              {TUTORIALS.filter(t => t.difficulty === 'beginner').slice(0, 3).map(tutorial => (
                <button
                  key={tutorial.id}
                  onClick={() => {
                    setSelectedTutorial(tutorial);
                    markAsWatched(tutorial.id);
                  }}
                  className="flex items-center gap-3 p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors text-left"
                >
                  <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
                    {watchedVideos.includes(tutorial.id) ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{tutorial.title}</p>
                    <p className="text-xs text-white/60">{tutorial.duration}</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tutorial Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {filteredTutorials.map(tutorial => {
          const isWatched = watchedVideos.includes(tutorial.id);
          return (
            <Card 
              key={tutorial.id}
              className={`hover:shadow-md transition-all cursor-pointer group ${isWatched ? 'border-green-200' : ''}`}
              onClick={() => {
                setSelectedTutorial(tutorial);
                markAsWatched(tutorial.id);
              }}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  {/* Play Button / Thumbnail */}
                  <div className={`relative flex-shrink-0 w-20 h-20 rounded-lg flex items-center justify-center ${
                    isWatched ? 'bg-green-100' : 'bg-gray-100 group-hover:bg-[#d4a574]/10'
                  } transition-colors`}>
                    {isWatched ? (
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    ) : (
                      <Play className="w-8 h-8 text-gray-400 group-hover:text-[#d4a574] transition-colors" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{tutorial.title}</h3>
                      {isWatched && (
                        <Badge variant="outline" className="text-green-600 border-green-300 text-xs flex-shrink-0">
                          Watched
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-2">{tutorial.description}</p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-gray-400">
                        <Clock className="w-3 h-3" />
                        {tutorial.duration}
                      </span>
                      <Badge className={`text-xs ${getDifficultyColor(tutorial.difficulty)}`}>
                        {tutorial.difficulty}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {tutorial.category}
                      </Badge>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#d4a574] transition-colors flex-shrink-0 mt-2" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredTutorials.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Search className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="font-medium">No tutorials found</p>
            <p className="text-sm">Try adjusting your search or filter criteria</p>
          </CardContent>
        </Card>
      )}

      {/* Tutorial Player Modal */}
      <Dialog open={!!selectedTutorial} onOpenChange={() => setSelectedTutorial(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTutorial?.icon}
              {selectedTutorial?.title}
            </DialogTitle>
          </DialogHeader>

          {selectedTutorial && (
            <div className="space-y-4">
              {/* Video Placeholder */}
              <div className="aspect-video bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] rounded-lg flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 hover:bg-white/30 transition-colors cursor-pointer">
                    <Play className="w-8 h-8 ml-1" />
                  </div>
                  <p className="text-lg font-semibold">{selectedTutorial.title}</p>
                  <p className="text-white/60 text-sm mt-1">Duration: {selectedTutorial.duration}</p>
                  <p className="text-white/40 text-xs mt-3">Video content coming soon</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-gray-700">{selectedTutorial.description}</p>
              </div>

              {/* Topics Covered */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Topics Covered:</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedTutorial.topics.map(topic => (
                    <Badge key={topic} variant="secondary">{topic}</Badge>
                  ))}
                </div>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-4 pt-2 border-t text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {selectedTutorial.duration}
                </span>
                <Badge className={getDifficultyColor(selectedTutorial.difficulty)}>
                  {selectedTutorial.difficulty}
                </Badge>
                <span>{selectedTutorial.category}</span>
                {watchedVideos.includes(selectedTutorial.id) && (
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Watched
                  </Badge>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
