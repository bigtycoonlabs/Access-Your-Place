
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Link2, Copy, Mail, CheckCircle, Clock, AlertTriangle,
  Camera, Video, Image, Shield, FileSignature, Wrench, Package,
  ExternalLink, RefreshCw, ThumbsUp, ThumbsDown, Eye, X
} from 'lucide-react';

interface Props {
  project: any;
  staffName: string;
  onUpdate: (project: any) => void;
}

export function SetupProManagement({ project, staffName, onUpdate }: Props) {
  const [saving, setSaving] = useState(false);
  const [reuploadNotes, setReuploadNotes] = useState('');
  const [flagNotes, setFlagNotes] = useState('');
  const [showMaintenanceDetail, setShowMaintenanceDetail] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const { toast } = useToast();
  const p = project;

  const callAction = async (action: string, extra: any = {}) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-setup-tasks', {
        body: { action, project_id: p.id, staff_name: staffName, ...extra }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.project) onUpdate(data.project);
      return data;
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateToken = async () => {
    const data = await callAction('generate_pro_token');
    if (data?.portal_url) {
      navigator.clipboard.writeText(data.portal_url);
      toast({ title: 'Token Generated', description: 'Portal link copied to clipboard!' });
    }
  };

  const handleEmailProLink = async () => {
    const data = await callAction('email_pro_portal_link');
    if (data?.emailed_to) {
      toast({ title: 'Email Sent', description: `Portal link emailed to ${data.emailed_to}` });
    }
  };

  const copyPortalLink = () => {
    if (p.pro_portal_token) {
      navigator.clipboard.writeText(`https://accessyourplace.com/pro-portal/${p.pro_portal_token}`);
      toast({ title: 'Copied', description: 'Portal link copied to clipboard' });
    }
  };

  const handleApproveMaintenance = () => callAction('approve_maintenance');
  const handleFlagMaintenance = () => callAction('flag_maintenance', { flagged_items: [], notes: flagNotes });
  const handleApproveMedia = () => callAction('approve_media');
  const handleRequestReupload = () => {
    callAction('request_media_reupload', { notes: reuploadNotes });
    setReuploadNotes('');
  };

  const spreadsheet = Array.isArray(p.sourcing_spreadsheet) ? p.sourcing_spreadsheet : [];
  const deliveredCount = spreadsheet.filter((i: any) => i.delivered).length;
  const placedCount = spreadsheet.filter((i: any) => i.placed).length;
  const photos = Array.isArray(p.media_photos) ? p.media_photos : [];
  const videos = Array.isArray(p.media_videos) ? p.media_videos : [];
  const maintenanceData = p.maintenance_check_data || {};

  return (
    <div className="space-y-4">
      {/* Pro Info Header */}
      <Card className={p.setup_pro_name ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200'}>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-[#1a365d]">{p.setup_pro_name || 'No Setup Pro Assigned'}</p>
              {p.setup_pro_email && <p className="text-xs text-gray-500">{p.setup_pro_email}</p>}
            </div>
            {p.setup_pro_name && (
              <div className="flex items-center gap-2">
                {p.pro_contract_signed ? (
                  <Badge className="bg-green-100 text-green-700 text-xs"><Shield className="w-3 h-3 mr-1" />Contract Signed</Badge>
                ) : p.pro_contract_sent ? (
                  <Badge className="bg-amber-100 text-amber-700 text-xs"><Clock className="w-3 h-3 mr-1" />Contract Pending</Badge>
                ) : (
                  <Badge className="bg-gray-100 text-gray-600 text-xs">No Contract</Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 1. Portal Token / Link */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#d4a574]" />
            Pro Portal Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {p.pro_portal_token ? (
            <>
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2.5 border">
                <code className="text-xs text-gray-600 flex-1 truncate">
                  accessyourplace.com/pro-portal/{p.pro_portal_token.substring(0, 12)}...
                </code>
                <Button size="sm" variant="ghost" onClick={copyPortalLink} className="h-7">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <a
                  href={`https://accessyourplace.com/pro-portal/${p.pro_portal_token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center"
                >
                  <Button size="sm" variant="ghost" className="h-7">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </a>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Generated: {p.pro_portal_token_created_at ? new Date(p.pro_portal_token_created_at).toLocaleString() : 'Unknown'}</span>
                {p.pro_portal_last_accessed && (
                  <span>| Last accessed: {new Date(p.pro_portal_last_accessed).toLocaleString()}</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleEmailProLink} disabled={saving || !p.setup_pro_email}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Mail className="w-3.5 h-3.5 mr-1" />}
                  Email Link to Pro
                </Button>
                <Button size="sm" variant="outline" onClick={handleGenerateToken} disabled={saving}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />Regenerate
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <Link2 className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500 mb-3">No portal link generated yet</p>
              <Button onClick={handleGenerateToken} disabled={saving || !p.setup_pro_name} className="bg-[#d4a574] hover:bg-[#c49464]">
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Link2 className="w-4 h-4 mr-1" />}
                Generate Portal Link
              </Button>
              {!p.setup_pro_name && <p className="text-xs text-gray-400 mt-2">Assign a Setup Pro first</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Delivery Activity Tracker */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-500" />
            Delivery Activity
            {spreadsheet.length > 0 && (
              <Badge variant="outline" className="text-xs ml-auto">
                {deliveredCount}/{spreadsheet.length} delivered | {placedCount}/{spreadsheet.length} placed
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {spreadsheet.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No items in spreadsheet yet</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {spreadsheet.map((item: any, i: number) => (
                <div key={i} className={`flex items-center gap-2 text-xs p-1.5 rounded ${item.delivered && item.placed ? 'bg-green-50' : item.delivered ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  <span className="font-medium flex-1 truncate">{item.name || `Item ${i + 1}`}</span>
                  <span className="text-gray-500">x{item.quantity || 1}</span>
                  {item.delivered ? (
                    <Badge className="bg-blue-100 text-blue-700 text-[10px]">Delivered</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-500 text-[10px]">Pending</Badge>
                  )}
                  {item.placed ? (
                    <Badge className="bg-green-100 text-green-700 text-[10px]">Placed</Badge>
                  ) : item.delivered ? (
                    <Badge className="bg-amber-100 text-amber-700 text-[10px]">Not Placed</Badge>
                  ) : null}
                  {item.updated_at && (
                    <span className="text-[10px] text-gray-400">{new Date(item.updated_at).toLocaleDateString()}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Maintenance Check Review */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wrench className="w-4 h-4 text-orange-500" />
            Maintenance Check
            {p.maintenance_check_completed && (
              <Badge className={
                p.maintenance_check_status === 'approved' ? 'bg-green-100 text-green-700 text-xs ml-auto' :
                p.maintenance_check_status === 'flagged' ? 'bg-red-100 text-red-700 text-xs ml-auto' :
                'bg-amber-100 text-amber-700 text-xs ml-auto'
              }>
                {p.maintenance_check_status === 'approved' ? 'Approved' :
                 p.maintenance_check_status === 'flagged' ? 'Flagged' : 'Pending Review'}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!p.maintenance_check_completed ? (
            <p className="text-sm text-gray-400 text-center py-4">Pro has not submitted maintenance check yet</p>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-gray-500">
                Submitted: {p.maintenance_check_submitted_at ? new Date(p.maintenance_check_submitted_at).toLocaleString() : 'Unknown'}
              </div>

              {/* Summary of maintenance data */}
              <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                {Object.entries(maintenanceData).length === 0 ? (
                  <p className="text-xs text-gray-400">No data available</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(maintenanceData).slice(0, 10).map(([key, value]: [string, any]) => (
                      <div key={key} className="text-xs">
                        <span className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}:</span>{' '}
                        <span className="font-medium">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value || 'N/A')}</span>
                      </div>
                    ))}
                  </div>
                )}
                {Object.entries(maintenanceData).length > 10 && (
                  <button onClick={() => setShowMaintenanceDetail(true)} className="text-xs text-blue-600 hover:underline mt-2">
                    View all {Object.entries(maintenanceData).length} fields...
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              {p.maintenance_check_status !== 'approved' && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleApproveMaintenance} disabled={saving} className="bg-green-600 hover:bg-green-700">
                    {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5 mr-1" />}
                    Approve
                  </Button>
                  <div className="flex-1 flex gap-2">
                    <Textarea
                      value={flagNotes}
                      onChange={e => setFlagNotes(e.target.value)}
                      placeholder="Flag notes..."
                      rows={1}
                      className="text-xs h-8 min-h-[32px]"
                    />
                    <Button size="sm" variant="destructive" onClick={handleFlagMaintenance} disabled={saving}>
                      <ThumbsDown className="w-3.5 h-3.5 mr-1" />Flag
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Media Review Gallery */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Camera className="w-4 h-4 text-purple-500" />
            Media Review
            {p.media_uploaded && (
              <>
                <Badge variant="outline" className="text-xs ml-auto">{photos.length} photos, {videos.length} videos</Badge>
                {p.media_approved ? (
                  <Badge className="bg-green-100 text-green-700 text-xs"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>
                ) : p.media_reupload_requested ? (
                  <Badge className="bg-red-100 text-red-700 text-xs"><AlertTriangle className="w-3 h-3 mr-1" />Re-upload Requested</Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700 text-xs">Pending Review</Badge>
                )}
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!p.media_uploaded ? (
            <p className="text-sm text-gray-400 text-center py-4">Pro has not uploaded media yet</p>
          ) : (
            <div className="space-y-3">
              {/* Photo Thumbnails */}
              {photos.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                    <Image className="w-3 h-3" />Photos ({photos.length})
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                    {photos.slice(0, 12).map((url: string, i: number) => (
                      <div key={i} className="aspect-square rounded-md overflow-hidden border bg-gray-100">
                        <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    ))}
                    {photos.length > 12 && (
                      <div className="aspect-square rounded-md bg-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-300" onClick={() => setShowMediaGallery(true)}>
                        <span className="text-sm font-bold text-gray-600">+{photos.length - 12}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Videos */}
              {videos.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                    <Video className="w-3 h-3" />Videos ({videos.length})
                  </p>
                  <div className="space-y-1">
                    {videos.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-blue-600 hover:underline p-1.5 bg-blue-50 rounded">
                        <Video className="w-3.5 h-3.5" />Video {i + 1}
                        <ExternalLink className="w-3 h-3 ml-auto" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Approval Actions */}
              {!p.media_approved && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleApproveMedia} disabled={saving} className="bg-green-600 hover:bg-green-700">
                      {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5 mr-1" />}
                      Approve Media
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      value={reuploadNotes}
                      onChange={e => setReuploadNotes(e.target.value)}
                      placeholder="What needs to be re-uploaded or re-shot..."
                      rows={2}
                      className="text-xs"
                    />
                    <Button size="sm" variant="destructive" onClick={handleRequestReupload} disabled={saving || !reuploadNotes.trim()} className="self-end">
                      <RefreshCw className="w-3.5 h-3.5 mr-1" />Request Re-upload
                    </Button>
                  </div>
                </div>
              )}

              {p.media_approved && p.media_approved_at && (
                <div className="text-xs text-green-700 flex items-center gap-1 bg-green-50 p-2 rounded">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Media approved on {new Date(p.media_approved_at).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Contract Signing Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-indigo-500" />
            Contractor Agreement
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!p.pro_contract_signed ? (
            <div className="flex items-center gap-3 py-2">
              <Clock className="w-5 h-5 text-gray-300" />
              <div>
                <p className="text-sm text-gray-600">
                  {p.pro_contract_sent ? 'Agreement sent, awaiting signature' : 'Agreement not yet sent'}
                </p>
                <p className="text-xs text-gray-400">
                  The Pro can sign the agreement through their portal
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-green-50 p-3 rounded-lg border border-green-200">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-800 text-sm">Agreement Signed</p>
                  <p className="text-xs text-green-700">
                    Signed on {p.pro_contract_signed_at ? new Date(p.pro_contract_signed_at).toLocaleString() : 'Unknown'}
                  </p>
                </div>
              </div>
              {p.pro_contract_signature && (
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Digital Signature:</p>
                  {p.pro_contract_signature.startsWith('data:image') ? (
                    <img src={p.pro_contract_signature} alt="Signature" className="max-h-16 border rounded" />
                  ) : (
                    <p className="font-serif italic text-lg text-gray-700">{p.pro_contract_signature}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Maintenance Detail Dialog */}
      {showMaintenanceDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowMaintenanceDetail(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Maintenance Check Details</h3>
              <button onClick={() => setShowMaintenanceDetail(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2">
              {Object.entries(maintenanceData).map(([key, value]: [string, any]) => (
                <div key={key} className="flex justify-between items-start py-1.5 border-b text-sm">
                  <span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="font-medium text-right ml-4">
                    {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value || 'N/A')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
