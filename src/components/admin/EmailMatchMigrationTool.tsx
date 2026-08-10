import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Loader2, Search, Link2, CheckCircle, AlertCircle, 
  Users, ArrowRight, RefreshCw, Zap
} from 'lucide-react';

interface EmailMatch {
  email: string;
  staff: {
    id: string;
    name: string;
  };
  investor: {
    id: string;
    name: string;
  };
  already_linked: boolean;
  has_pending_suggestion: boolean;
}

export function EmailMatchMigrationTool() {
  const [matches, setMatches] = useState<EmailMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [linkingEmail, setLinkingEmail] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number; unlinked: number } | null>(null);
  const { toast } = useToast();

  const findMatches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: { action: 'find_matching_emails' }
      });

      if (error) throw error;

      if (data?.success) {
        setMatches(data.matches || []);
        setStats({
          total: data.total_matches || 0,
          unlinked: data.unlinked_matches || 0
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to find matching emails',
        variant: 'destructive'
      });
    }
    setLoading(false);
  };

  const createBulkSuggestions = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: { action: 'create_bulk_link_suggestions' }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Link Suggestions Created',
          description: data.message
        });
        // Refresh the list
        findMatches();
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create link suggestions',
        variant: 'destructive'
      });
    }
    setCreating(false);
  };

  const autoLinkByEmail = async (email: string) => {
    setLinkingEmail(email);
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: { action: 'auto_link_by_email', email }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Accounts Linked!',
          description: `${data.staff_name} is now linked to ${data.investor_name}`
        });
        // Update the local state
        setMatches(prev => prev.map(m => 
          m.email === email ? { ...m, already_linked: true } : m
        ));
        if (stats) {
          setStats({ ...stats, unlinked: stats.unlinked - 1 });
        }
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to link accounts',
        variant: 'destructive'
      });
    }
    setLinkingEmail(null);
  };

  const unlinkedMatches = matches.filter(m => !m.already_linked);
  const linkedMatches = matches.filter(m => m.already_linked);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-blue-600" />
          Email Match Migration Tool
        </CardTitle>
        <CardDescription>
          Find and link staff and investor accounts that share the same email address.
          This enables seamless switching between portals.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={findMatches}
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            Find Matching Emails
          </Button>

          {stats && stats.unlinked > 0 && (
            <Button
              onClick={createBulkSuggestions}
              disabled={creating}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              Create Link Suggestions for All
            </Button>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-gray-50">
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-gray-700">{stats.total}</p>
                <p className="text-xs text-gray-500">Total Matches Found</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-amber-600">{stats.unlinked}</p>
                <p className="text-xs text-amber-700">Unlinked Matches</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-green-600">{stats.total - stats.unlinked}</p>
                <p className="text-xs text-green-700">Already Linked</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Unlinked Matches */}
        {unlinkedMatches.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Unlinked Matches ({unlinkedMatches.length})
            </h4>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Staff Account</TableHead>
                    <TableHead className="text-center">
                      <ArrowRight className="w-4 h-4 mx-auto" />
                    </TableHead>
                    <TableHead>Investor Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unlinkedMatches.map((match) => (
                    <TableRow key={match.email}>
                      <TableCell className="font-medium">{match.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-500" />
                          {match.staff.name || 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Link2 className="w-4 h-4 mx-auto text-gray-400" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-green-500" />
                          {match.investor.name || 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {match.has_pending_suggestion ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
                            Suggestion Pending
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">
                            Not Linked
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => autoLinkByEmail(match.email)}
                          disabled={linkingEmail === match.email}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {linkingEmail === match.email ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Link2 className="w-4 h-4 mr-1" />
                              Link Now
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Already Linked */}
        {linkedMatches.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Already Linked ({linkedMatches.length})
            </h4>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Staff Account</TableHead>
                    <TableHead className="text-center">
                      <Link2 className="w-4 h-4 mx-auto" />
                    </TableHead>
                    <TableHead>Investor Account</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedMatches.map((match) => (
                    <TableRow key={match.email} className="bg-green-50/50">
                      <TableCell className="font-medium">{match.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-500" />
                          {match.staff.name || 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Link2 className="w-4 h-4 mx-auto text-green-500" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-green-500" />
                          {match.investor.name || 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Linked
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {matches.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p>Click "Find Matching Emails" to scan for accounts that can be linked.</p>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <h5 className="font-medium text-blue-900 mb-2">How Account Linking Works</h5>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• When a staff member and investor share the same email, they can be linked</li>
            <li>• Linked accounts can switch between Staff Dashboard and Operator Portal without logging out</li>
            <li>• New staff invitations and investor signups automatically detect matching emails</li>
            <li>• Users are prompted to link their accounts when a match is found</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
