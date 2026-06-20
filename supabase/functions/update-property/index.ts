const DATA_SCHEMA = 'prj_X-ZoVQv6LKXT';
const originalFetch = globalThis.fetch;
globalThis.fetch = (input: any, init: any = {}) => {
  const url = typeof input === 'string'
    ? input
    : input?.url?.toString?.() || input?.toString?.() || '';

  if (url.includes('/rest/v1/')) {
    const headers = new Headers(init.headers || {});
    headers.set('Accept-Profile', DATA_SCHEMA);
    headers.set('Content-Profile', DATA_SCHEMA);
    init = { ...init, headers };
  }

  return originalFetch(input, init);
};
// update-property v4.4 - Map listing_descriptionâ†’description, strip non-existent columns
// Added: deal_status_notifications insertion for AM alerts on status changes
// Always return HTTP 200 (like delete-property v4.0 pattern)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (data: any) => new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseKey) {
      return json({ success: false, error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json().catch(() => ({}));
    const { id, property_id, ...updates } = body;
    const propId = id || property_id;

    console.log('[update-property v4.4] Property ID:', propId, 'Fields:', Object.keys(updates).join(', '));

    if (!propId) {
      return json({ success: false, error: 'Property ID is required (pass as "id" or "property_id")' });
    }

    // v4.3: Map listing_description â†’ description (properties table uses "description")
    if ('listing_description' in updates) {
      if (!updates.description) {
        updates.description = updates.listing_description;
      }
      delete updates.listing_description;
      console.log('[update-property v4.4] Mapped listing_description â†’ description');
    }

    // Get current property state for comparison
    const { data: currentProperty, error: fetchError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propId)
      .single();

    if (fetchError || !currentProperty) {
      console.error('[update-property v4.4] Property not found:', fetchError);
      return json({ success: false, error: 'Property not found', details: fetchError?.message });
    }

    // Track workflow stage changes
    const oldStage = currentProperty.workflow_stage || 'new';
    const newStage = updates.workflow_stage;
    const stageChanged = newStage && newStage !== oldStage;

    if (stageChanged) {
      updates.workflow_stage_entered_at = new Date().toISOString();
    }

    // Clean up: remove non-column fields that shouldn't be saved
    const nonColumnFields = ['updated_by_staff_id', 'updated_by_staff_name', 'stage_change_notes', 'auto_transitioned'];
    const staffId = updates.updated_by_staff_id;
    const staffName = updates.updated_by_staff_name;
    const stageChangeNotes = updates.stage_change_notes;
    const autoTransitioned = updates.auto_transitioned;
    for (const field of nonColumnFields) {
      delete updates[field];
    }

    // v4.3: If verified_by is being set, resolve it from staffName if it's the default 'Staff'
    if (updates.verified_by === 'Staff' && staffName && staffName !== 'Staff') {
      updates.verified_by = staffName;
    }
    if (updates.is_verified !== undefined && !updates.verified_by && staffName) {
      updates.verified_by = staffName;
    }

    // Update the property
    const { data: property, error: updateError } = await supabase
      .from('properties')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', propId)
      .select()
      .single();

    if (updateError) {
      console.error('[update-property v4.4] Update error:', updateError);
      return json({ success: false, error: 'Failed to update property: ' + updateError.message });
    }

    console.log('[update-property v4.4] Property updated successfully');

    // Sync photos to property_photos table if photos array was updated
    let photosQueued = 0;
    if (updates.photos && Array.isArray(updates.photos)) {
      const newPhotos = updates.photos;
      const oldPhotos = currentProperty.photos || [];

      if (JSON.stringify(newPhotos) !== JSON.stringify(oldPhotos)) {
        console.log('[update-property v4.4] Photos changed, syncing:', newPhotos.length);

        const { data: existingPhotos } = await supabase
          .from('property_photos')
          .select('id, original_url, processed_url')
          .eq('property_id', propId);

        const existingUrls = new Set((existingPhotos || []).map(p => p.original_url || p.processed_url));

        for (let i = 0; i < newPhotos.length; i++) {
          const photoUrl = newPhotos[i];
          if (!existingUrls.has(photoUrl)) {
            try {
              const { error: photoError } = await supabase
                .from('property_photos')
                .insert({
                  property_id: propId,
                  original_url: photoUrl,
                  processed_url: photoUrl,
                  display_order: i,
                  is_primary: i === 0,
                  processing_status: 'pending',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
              if (!photoError) photosQueued++;
            } catch (e) {
              console.error('[update-property v4.4] Photo insert error:', e);
            }
          }
        }

        // Update display order
        for (let i = 0; i < newPhotos.length; i++) {
          await supabase
            .from('property_photos')
            .update({ display_order: i, is_primary: i === 0 })
            .eq('property_id', propId)
            .or(`original_url.eq.${newPhotos[i]},processed_url.eq.${newPhotos[i]}`);
        }

        // Remove deleted photos
        const newUrlsSet = new Set(newPhotos);
        const photosToRemove = (existingPhotos || []).filter(p =>
          !newUrlsSet.has(p.original_url) && !newUrlsSet.has(p.processed_url)
        );
        if (photosToRemove.length > 0) {
          await supabase
            .from('property_photos')
            .delete()
            .in('id', photosToRemove.map(p => p.id));
        }

        // Trigger background processing
        if (photosQueued > 0) {
          try {
            fetch(`${supabaseUrl}/functions/v1/background-photo-processing`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`
              },
              body: JSON.stringify({ action: 'process_property', property_id: propId })
            }).catch(e => console.error('Background processing trigger error:', e));
          } catch (e) { /* ignore */ }
        }
      }
    }

    // Log activity for significant changes
    const activityLogs = [];

    if (stageChanged) {
      activityLogs.push({
        property_id: propId,
        activity_type: 'stage_change',
        description: `Workflow stage changed from "${oldStage}" to "${newStage}"`,
        old_value: oldStage,
        new_value: newStage,
        staff_id: staffId || null,
        staff_name: staffName || null,
        metadata: { notes: stageChangeNotes || null }
      });

      try {
        await supabase
          .from('deal_workflow_stages')
          .update({
            exited_at: new Date().toISOString(),
            duration_minutes: Math.round((Date.now() - new Date(currentProperty.workflow_stage_entered_at || currentProperty.created_at).getTime()) / 60000)
          })
          .eq('property_id', propId)
          .eq('stage', oldStage)
          .is('exited_at', null);

        await supabase.from('deal_workflow_stages').insert({
          property_id: propId,
          stage: newStage,
          staff_id: staffId || null,
          staff_name: staffName || null,
          notes: stageChangeNotes || null,
          auto_transitioned: autoTransitioned || false
        });
      } catch (e) {
        console.error('[update-property v4.4] Workflow stage log error:', e);
      }
    }

    if (updates.status && updates.status !== currentProperty.status) {
      activityLogs.push({
        property_id: propId,
        activity_type: 'status_change',
        description: `Status changed from "${currentProperty.status || 'none'}" to "${updates.status}"`,
        old_value: currentProperty.status,
        new_value: updates.status,
        staff_id: staffId || null,
        staff_name: staffName || null
      });
    }

    if (updates.deal_status && updates.deal_status !== currentProperty.deal_status) {
      activityLogs.push({
        property_id: propId,
        activity_type: 'deal_status_change',
        description: `Deal status changed from "${currentProperty.deal_status || 'none'}" to "${updates.deal_status}"`,
        old_value: currentProperty.deal_status,
        new_value: updates.deal_status,
        staff_id: staffId || null,
        staff_name: staffName || null
      });
    }

    if (updates.is_verified !== undefined && updates.is_verified !== currentProperty.is_verified) {
      const verifiedBy = updates.verified_by || staffName || 'Staff';
      activityLogs.push({
        property_id: propId,
        activity_type: updates.is_verified ? 'verified' : 'verification_rejected',
        description: updates.is_verified 
          ? `Deal verified by ${verifiedBy}` 
          : `Deal verification rejected by ${verifiedBy}`,
        old_value: String(currentProperty.is_verified || false),
        new_value: String(updates.is_verified),
        staff_id: staffId || null,
        staff_name: verifiedBy,
        metadata: {
          verification_notes: updates.verification_notes || null,
          verification_checklist: updates.verification_checklist || null,
          verified_at: updates.verified_at || new Date().toISOString()
        }
      });
    }

    if (updates.is_published && !currentProperty.is_published) {
      activityLogs.push({
        property_id: propId,
        activity_type: 'published',
        description: 'Deal published to marketplace',
        old_value: 'unpublished',
        new_value: 'published',
        staff_id: staffId || null,
        staff_name: staffName || null
      });

      try {
        await supabase.from('staff_notifications').insert({
          notification_type: 'deal_published',
          title: 'New Deal Published',
          message: `${property.listing_title || property.address} in ${property.city}, ${property.state} is now live.`,
          priority: 'normal',
          target_department: 'success_managers',
          metadata: { property_id: propId, address: property.address, city: property.city, state: property.state }
        });
      } catch (e) { /* ignore */ }
    }

    if (updates.photos && JSON.stringify(updates.photos) !== JSON.stringify(currentProperty.photos)) {
      activityLogs.push({
        property_id: propId,
        activity_type: 'photos_updated',
        description: `Photos updated (${(currentProperty.photos || []).length} â†’ ${(updates.photos || []).length})`,
        old_value: String((currentProperty.photos || []).length),
        new_value: String((updates.photos || []).length),
        staff_id: staffId || null,
        staff_name: staffName || null
      });
    }

    if (activityLogs.length > 0) {
      try {
        await supabase.from('deal_activity_log').insert(activityLogs);
      } catch (e) { /* ignore */ }
    }

    // Auto-transition to published stage
    if (property.is_published && property.workflow_stage !== 'published') {
      await supabase.from('properties').update({
        workflow_stage: 'published',
        workflow_stage_entered_at: new Date().toISOString()
      }).eq('id', propId);
    }

    // ========== v4.4: INSERT DEAL STATUS NOTIFICATIONS FOR AM ==========
    // Notify the submitting AM when deal_status, is_verified, or is_published changes
    const amStaffId = currentProperty.added_by_staff_id || currentProperty.found_by_am_id;
    
    if (amStaffId) {
      const dealTitle = property.listing_title || property.title || property.address || 'Property';
      const dealLocation = [property.city, property.state].filter(Boolean).join(', ');
      const reviewerName = staffName || 'Success Team';
      const notificationsToInsert: any[] = [];

      // 1. deal_status changed
      if (updates.deal_status && updates.deal_status !== currentProperty.deal_status) {
        const oldDs = currentProperty.deal_status || 'none';
        const newDs = updates.deal_status;

        let notifType = 'deal_status_change';
        let notifMessage = `Your deal "${dealTitle}" status changed from ${oldDs} to ${newDs}.`;

        if (newDs === 'am_approved') {
          notifType = 'deal_approved';
          notifMessage = `Your deal "${dealTitle}"${dealLocation ? ` in ${dealLocation}` : ''} has been approved by ${reviewerName}.`;
        } else if (newDs === 'am_denied') {
          notifType = 'deal_rejected';
          notifMessage = `Your deal "${dealTitle}"${dealLocation ? ` in ${dealLocation}` : ''} was not approved by ${reviewerName}.${updates.denial_reason ? ' Reason: ' + updates.denial_reason : ''}`;
        }

        notificationsToInsert.push({
          property_id: propId,
          property_title: dealTitle,
          property_address: property.address,
          property_city: property.city,
          property_state: property.state,
          recipient_staff_id: amStaffId,
          recipient_staff_name: currentProperty.found_by_am_name || currentProperty.added_by_staff_name,
          reviewer_staff_id: staffId || null,
          reviewer_staff_name: reviewerName,
          old_status: oldDs,
          new_status: newDs,
          notification_type: notifType,
          message: notifMessage,
          is_read: false,
          email_sent: false,
          metadata: { denial_reason: updates.denial_reason || null },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      // 2. is_verified changed (and not already covered by deal_status)
      if (updates.is_verified !== undefined && updates.is_verified !== currentProperty.is_verified) {
        const alreadyCoveredByDealStatus = updates.deal_status && updates.deal_status !== currentProperty.deal_status;
        if (!alreadyCoveredByDealStatus) {
          const verifiedBy = updates.verified_by || staffName || 'Success Team';
          notificationsToInsert.push({
            property_id: propId,
            property_title: dealTitle,
            property_address: property.address,
            property_city: property.city,
            property_state: property.state,
            recipient_staff_id: amStaffId,
            recipient_staff_name: currentProperty.found_by_am_name || currentProperty.added_by_staff_name,
            reviewer_staff_id: staffId || null,
            reviewer_staff_name: verifiedBy,
            old_status: String(currentProperty.is_verified || false),
            new_status: updates.is_verified ? 'verified' : 'verification_rejected',
            notification_type: updates.is_verified ? 'deal_verified' : 'deal_rejected',
            message: updates.is_verified
              ? `Your deal "${dealTitle}"${dealLocation ? ` in ${dealLocation}` : ''} has been verified by ${verifiedBy}.`
              : `Your deal "${dealTitle}"${dealLocation ? ` in ${dealLocation}` : ''} verification was rejected by ${verifiedBy}.`,
            is_read: false,
            email_sent: false,
            metadata: { verification_notes: updates.verification_notes || null },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }

      // 3. is_published changed to true
      if (updates.is_published && !currentProperty.is_published) {
        notificationsToInsert.push({
          property_id: propId,
          property_title: dealTitle,
          property_address: property.address,
          property_city: property.city,
          property_state: property.state,
          recipient_staff_id: amStaffId,
          recipient_staff_name: currentProperty.found_by_am_name || currentProperty.added_by_staff_name,
          reviewer_staff_id: staffId || null,
          reviewer_staff_name: reviewerName,
          old_status: 'unpublished',
          new_status: 'published',
          notification_type: 'deal_published',
          message: `Your deal "${dealTitle}"${dealLocation ? ` in ${dealLocation}` : ''} has been published to the marketplace by ${reviewerName}!`,
          is_read: false,
          email_sent: false,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      // 4. is_published changed to false (unpublished)
      if (updates.is_published === false && currentProperty.is_published === true) {
        notificationsToInsert.push({
          property_id: propId,
          property_title: dealTitle,
          property_address: property.address,
          property_city: property.city,
          property_state: property.state,
          recipient_staff_id: amStaffId,
          recipient_staff_name: currentProperty.found_by_am_name || currentProperty.added_by_staff_name,
          reviewer_staff_id: staffId || null,
          reviewer_staff_name: reviewerName,
          old_status: 'published',
          new_status: 'unpublished',
          notification_type: 'deal_unpublished',
          message: `Your deal "${dealTitle}"${dealLocation ? ` in ${dealLocation}` : ''} has been unpublished by ${reviewerName}.`,
          is_read: false,
          email_sent: false,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      // Insert all notifications
      if (notificationsToInsert.length > 0) {
        try {
          const { error: notifError } = await supabase
            .from('deal_status_notifications')
            .insert(notificationsToInsert);
          
          if (notifError) {
            console.error('[update-property v4.4] Notification insert error:', notifError);
          } else {
            console.log(`[update-property v4.4] Inserted ${notificationsToInsert.length} deal status notification(s) for AM ${amStaffId}`);
          }

          // Send email for critical notification types via deal-flow-notifications
          const criticalTypes = ['deal_approved', 'deal_rejected', 'deal_published', 'deal_verified'];
          for (const notif of notificationsToInsert) {
            if (criticalTypes.includes(notif.notification_type)) {
              try {
                // Look up AM email
                const { data: amStaff } = await supabase
                  .from('staff_users')
                  .select('email, name, first_name, last_name')
                  .eq('id', amStaffId)
                  .single();

                if (amStaff?.email) {
                  // Fire-and-forget email via deal-flow-notifications
                  fetch(`${supabaseUrl}/functions/v1/deal-flow-notifications`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseKey}`
                    },
                    body: JSON.stringify({
                      action: 'insert_deal_status_notification',
                      ...notif,
                      recipient_email: amStaff.email,
                      recipient_staff_name: amStaff.first_name ? `${amStaff.first_name} ${amStaff.last_name || ''}`.trim() : amStaff.name || notif.recipient_staff_name,
                      send_email: true
                    })
                  }).catch(e => console.error('[update-property v4.4] Email trigger error:', e));
                }
              } catch (e) {
                console.error('[update-property v4.4] AM email lookup error:', e);
              }
            }
          }
        } catch (e) {
          console.error('[update-property v4.4] Notification error:', e);
        }
      }
    }
    // ========== END v4.4 NOTIFICATIONS ==========

    return json({
      success: true,
      property,
      activity_logged: activityLogs.length,
      photos_queued: photosQueued
    });

  } catch (error: any) {
    console.error('[update-property v4.4] Error:', error);
    return json({ success: false, error: error.message || String(error) });
  }
});

