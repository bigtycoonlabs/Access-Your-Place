import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Link2, Unlink, Search, User, Mail, Building, 
  CheckCircle, AlertCircle, ArrowRightLeft, Shield
} from 'lucide-react';

interface AccountLinkingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'staff' | 'investor';
  sourceAccount: {
    id: string;
    name: string;
    email: string;
    linkedAccountId?: string;
    linkedAccountName?: string;
    linkedAccountEmail?: string;
  };
  onLinked: () => void;
}

interface SearchResult {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company_name?: string;
  department?: string;
  already_linked?: boolean;
}

export function AccountLinkingModal({ 
  open, 
  onOpenChange, 
  mode, 
  sourceAccount, 
  onLinked 
}: AccountLinkingModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<SearchResult | null>(null);
  const { toast } = useToast();

  const isLinkingToInvestor = mode === 'staff';
  const targetType = isLinkingToInvestor ? 'investor' : 'staff';

  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedAccount(null);
    }
  }, [open]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      if (isLinkingToInvestor) {
        // Search for investors
        const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
          body: { 
            action: 'list_investors',
            search: searchQuery,
            limit: 20
          }
        });
        
        if (data?.investors) {
          setSearchResults(data.investors.map((inv: any) => ({
            id: inv.id,
            name: inv.full_name || `${inv.first_name || ''} ${inv.last_name || ''}`.trim() || inv.email,
            email: inv.email,
            phone: inv.phone,
            company_name: inv.company_name,
            already_linked: !!inv.linked_staff_id
          })));
        }
      } else {
        // Search for staff
        const { data, error } = await supabase.functions.invoke('manage-staff', {
          body: { action: 'get_staff' }
        });
        
        if (data?.staff) {
          const filtered = data.staff.filter((s: any) => 
            s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.name?.toLowerCase().includes(searchQuery.toLowerCase())
          );
          
          setSearchResults(filtered.map((s: any) => ({
            id: s.id,
            name: s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim(),
            email: s.email,
            phone: s.phone,
            department: s.department,
            already_linked: !!s.linked_investor_id
          })));
        }
      }
    } catch (err) {
      console.error('Search error:', err);
      toast({
        title: 'Search Failed',
        description: 'Unable to search accounts',
        variant: 'destructive'
      });
    }
    setSearching(false);
  };

  const handleLink = async () => {
    if (!selectedAccount) return;
    
    setLinking(true);
    try {
      if (isLinkingToInvestor) {
        // Link staff to investor
        const { data, error } = await supabase.functions.invoke('manage-staff', {
          body: {
            action: 'link_investor_account',
            staff_id: sourceAccount.id,
            investor_email: selectedAccount.email
          }
        });
        
        if (data?.success) {
          toast({
            title: 'Accounts Linked',
            description: `Staff account linked to investor: ${selectedAccount.name}`
          });
          onLinked();
          onOpenChange(false);
        } else {
          throw new Error(data?.error || 'Failed to link accounts');
        }
      } else {
        // Link investor to staff
        const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
          body: {
            action: 'link_staff_account',
            investor_id: sourceAccount.id,
            staff_id: selectedAccount.id
          }
        });
        
        if (data?.success) {
          toast({
            title: 'Accounts Linked',
            description: `Investor account linked to staff: ${selectedAccount.name}`
          });
          onLinked();
          onOpenChange(false);
        } else {
          throw new Error(data?.error || 'Failed to link accounts');
        }
      }
    } catch (err: any) {
      toast({
        title: 'Link Failed',
        description: err.message || 'Unable to link accounts',
        variant: 'destructive'
      });
    }
    setLinking(false);
  };

  const handleUnlink = async () => {
    if (!confirm('Are you sure you want to unlink these accounts? The user will need to log in separately to each portal.')) {
      return;
    }
    
    setLinking(true);
    try {
      if (isLinkingToInvestor) {
        const { data, error } = await supabase.functions.invoke('manage-staff', {
          body: {
            action: 'unlink_investor_account',
            staff_id: sourceAccount.id
          }
        });
        
        if (data?.success) {
          toast({
            title: 'Accounts Unlinked',
            description: 'Staff and investor accounts are no longer linked'
          });
          onLinked();
          onOpenChange(false);
        }
      } else {
        const { data, error } = await supabase.functions.invoke('manage-investor-admin', {
          body: {
            action: 'unlink_staff_account',
            investor_id: sourceAccount.id
          }
        });
        
        if (data?.success) {
          toast({
            title: 'Accounts Unlinked',
            description: 'Investor and staff accounts are no longer linked'
          });
          onLinked();
          onOpenChange(false);
        }
      }
    } catch (err: any) {
      toast({
        title: 'Unlink Failed',
        description: err.message || 'Unable to unlink accounts',
        variant: 'destructive'
      });
    }
    setLinking(false);
  };

  const getDepartmentLabel = (dept: string) => {
    const labels: Record<string, string> = {
      success_managers: 'Success Team',
      acquisition_managers: 'Acquisition Manager',
      setup_managers: 'Setup Manager'
    };
    return labels[dept] || dept;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby="link-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-[#d4a574]" />
            {sourceAccount.linkedAccountId ? 'Manage Linked Account' : `Link to ${targetType === 'investor' ? 'Investor' : 'Staff'} Account`}
          </DialogTitle>
          <DialogDescription id="link-description">
            {sourceAccount.linkedAccountId 
              ? 'View or remove the linked account connection.'
              : `Search for an ${targetType} account to link with this ${mode} account. This allows seamless switching between portals.`
            }
          </DialogDescription>
        </DialogHeader>

        {/* Current Account Info */}
        <Card className="bg-gray-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] flex items-center justify-center text-white font-bold">
                {sourceAccount.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{sourceAccount.name}</p>
                <p className="text-sm text-gray-500">{sourceAccount.email}</p>
                <Badge variant="outline" className="mt-1">
                  {mode === 'staff' ? 'Staff Account' : 'Investor Account'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Already Linked */}
        {sourceAccount.linkedAccountId && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-green-800">
                      Linked to {targetType === 'investor' ? 'Investor' : 'Staff'}
                    </p>
                    <p className="text-sm text-green-700">{sourceAccount.linkedAccountName}</p>
                    <p className="text-xs text-green-600">{sourceAccount.linkedAccountEmail}</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleUnlink}
                  disabled={linking}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4 mr-1" />}
                  Unlink
                </Button>
              </div>
              
              <div className="mt-4 p-3 bg-white rounded-lg border border-green-200">
                <p className="text-sm text-green-800 flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4" />
                  This user can switch between portals without logging out
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search for Account to Link */}
        {!sourceAccount.linkedAccountId && (
          <>
            <div className="space-y-4">
              <div>
                <Label htmlFor="search-account">
                  Search {targetType === 'investor' ? 'Investors' : 'Staff Members'}
                </Label>
                <div className="flex gap-2 mt-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="search-account"
                      placeholder={`Search by name or email...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="pl-10"
                    />
                  </div>
                  <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                  </Button>
                </div>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <p className="text-sm text-gray-500">{searchResults.length} results found</p>
                  {searchResults.map((result) => (
                    <Card 
                      key={result.id}
                      className={`cursor-pointer transition-all ${
                        selectedAccount?.id === result.id 
                          ? 'border-[#d4a574] bg-amber-50' 
                          : result.already_linked 
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:border-gray-300'
                      }`}
                      onClick={() => !result.already_linked && setSelectedAccount(result)}
                    >
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                              <User className="w-4 h-4 text-gray-500" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{result.name}</p>
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {result.email}
                              </p>
                              {result.company_name && (
                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                  <Building className="w-3 h-3" />
                                  {result.company_name}
                                </p>
                              )}
                              {result.department && (
                                <Badge variant="outline" className="text-xs mt-1">
                                  <Shield className="w-3 h-3 mr-1" />
                                  {getDepartmentLabel(result.department)}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {result.already_linked ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              Already Linked
                            </Badge>
                          ) : selectedAccount?.id === result.id ? (
                            <CheckCircle className="w-5 h-5 text-[#d4a574]" />
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {searchQuery && searchResults.length === 0 && !searching && (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No {targetType}s found matching "{searchQuery}"</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleLink}
                disabled={!selectedAccount || linking}
                className="bg-[#d4a574] hover:bg-[#c49464]"
              >
                {linking && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Link2 className="w-4 h-4 mr-2" />
                Link Accounts
              </Button>
            </DialogFooter>
          </>
        )}

        {sourceAccount.linkedAccountId && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
