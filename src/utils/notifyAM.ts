import { supabase } from '@/lib/supabase';

/**
 * Notify the assigned Acquisition Manager about an investor's action.
 * This fires a background request to the manage-investor-admin edge function
 * which looks up the investor's assigned AM and sends them an email.
 * 
 * Also creates a direct staff_notifications record as a fallback
 * so the notification appears in the staff dashboard even if the edge function fails.
 * 
 * @param investorId - The investor's ID
 * @param actionType - Short label for the action (e.g., "Deal Interest", "New Dispute")
 * @param details - Human-readable description of what happened
 */
export async function notifyAMAboutAction(
  investorId: string,
  actionType: string,
  details: string
): Promise<void> {
  try {
    // 1. Try the edge function first (sends email + creates notification)
    supabase.functions.invoke('manage-investor-admin', {
      body: {
        action: 'notify_am_investor_action',
        investor_id: investorId,
        action_type: actionType,
        details
      }
    }).catch((err) => {
      console.error('[notifyAM] Edge function failed:', err);
    });

    // 2. Also create a direct staff_notifications record as fallback
    // This ensures the notification shows in the staff dashboard even if edge function fails
    createStaffDashboardNotification(investorId, actionType, details).catch((err) => {
      console.warn('[notifyAM] Direct notification insert failed:', err);
    });

    // 3. For property referrals, client referrals, and portfolio additions, also try send-notification-email
    if (actionType === 'Property Referral' || actionType === 'Investor Referral' || actionType === 'Client Referral' || actionType === 'Portfolio Property Added') {
      sendAMEmailNotification(investorId, actionType, details).catch((err) => {
        console.warn('[notifyAM] Email notification failed:', err);
      });
    }

  } catch (err) {
    // Silently fail - AM notifications should never block investor actions
    console.error('[notifyAM] Error:', err);
  }
}

/**
 * Create a direct notification record in the staff_notifications table.
 * This ensures the AM sees the notification in their dashboard.
 */
async function createStaffDashboardNotification(
  investorId: string,
  actionType: string,
  details: string
): Promise<void> {
  try {
    // Look up the investor's assigned AM
    const { data: investor } = await supabase
      .from('investors')
      .select('full_name, email, assigned_am_id, assigned_am_name')
      .eq('id', investorId)
      .single();

    const investorName = investor?.full_name || 'Unknown Investor';
    const investorEmail = investor?.email || '';
    const amId = investor?.assigned_am_id;
    const amName = investor?.assigned_am_name;

    // Determine notification type for categorization
    let notificationType = 'investor_action';
    if (actionType.toLowerCase().includes('referral')) notificationType = 'referral_submitted';
    if (actionType.toLowerCase().includes('property')) notificationType = 'property_referral';
    if (actionType.toLowerCase().includes('portfolio')) notificationType = 'portfolio_update';
    if (actionType.toLowerCase().includes('dispute')) notificationType = 'dispute_filed';
    if (actionType.toLowerCase().includes('message')) notificationType = 'new_message';

    // Insert into staff_notifications
    await supabase.from('staff_notifications').insert({
      type: notificationType,
      notification_type: notificationType,
      title: `${actionType} — ${investorName}`,
      message: details,
      investor_id: investorId,
      investor_name: investorName,
      investor_email: investorEmail,
      assigned_to: amId || null,
      assigned_am_name: amName || null,
      priority: actionType.includes('Referral') ? 'high' : 'medium',
      is_read: false,
      created_at: new Date().toISOString()
    });

    console.log(`[notifyAM] Staff notification created for ${actionType} by ${investorName}`);
  } catch (err) {
    // Try a simpler insert if the full one fails (some columns may not exist)
    try {
      await supabase.from('staff_notifications').insert({
        type: 'investor_action',
        title: `${actionType}`,
        message: `Investor ${investorId}: ${details}`,
        is_read: false,
        created_at: new Date().toISOString()
      });
    } catch {
      console.warn('[notifyAM] Simplified notification insert also failed');
    }
  }
}

/**
 * Send an email notification to the AM about a referral or important action.
 * Uses the send-notification-email edge function with Resend.
 */
async function sendAMEmailNotification(
  investorId: string,
  actionType: string,
  details: string
): Promise<void> {
  try {
    // Look up investor info
    const { data: investor } = await supabase
      .from('investors')
      .select('full_name, email, assigned_am_id, assigned_am_name')
      .eq('id', investorId)
      .single();

    if (!investor) return;

    // Try to get AM's email from staff table
    let amEmail = '';
    if (investor.assigned_am_id) {
      const { data: staff } = await supabase
        .from('staff')
        .select('email, full_name')
        .eq('id', investor.assigned_am_id)
        .single();
      amEmail = staff?.email || '';
    }

    // If we have an AM email, send them a notification
    if (amEmail) {
      await supabase.functions.invoke('send-notification-email', {
        body: {
          action: 'am_notification',
          to_email: amEmail,
          to_name: investor.assigned_am_name || 'Acquisition Manager',
          investor_name: investor.full_name,
          investor_email: investor.email,
          investor_id: investorId,
          action_type: actionType,
          details: details,
          subject: `[AYP Alert] ${actionType} from ${investor.full_name}`,
          template: 'am_action_alert',
          portal_url: `${window.location.origin}/staff-login`
        }
      });
      console.log(`[notifyAM] Email sent to AM ${amEmail} for ${actionType}`);
    }

    // Also notify the success team general inbox
    await supabase.functions.invoke('send-notification-email', {
      body: {
        action: 'team_notification',
        to_email: 'success@accessyourplace.com',
        to_name: 'Success Team',
        investor_name: investor.full_name,
        investor_email: investor.email,
        investor_id: investorId,
        action_type: actionType,
        details: details,
        subject: `[AYP] ${actionType} — ${investor.full_name}`,
        template: 'team_notification',
        portal_url: `${window.location.origin}/staff-login`
      }
    }).catch(() => {
      // Non-critical - success team email is a bonus
    });

  } catch (err) {
    console.warn('[notifyAM] AM email notification failed:', err);
  }
}

/**
 * Notify investor about a status change on their referral or portfolio property.
 * Creates an investor_notifications record and sends email via Resend.
 */
export async function notifyInvestorAboutUpdate(
  investorId: string,
  notificationType: string,
  title: string,
  message: string
): Promise<void> {
  try {
    // 1. Create investor notification record
    await supabase.from('investor_notifications').insert({
      investor_id: investorId,
      type: notificationType,
      notification_type: notificationType,
      title: title,
      message: message,
      is_read: false,
      read: false,
      created_at: new Date().toISOString()
    }).then(({ error }) => {
      if (error) {
        // Try simpler schema
        return supabase.from('investor_notifications').insert({
          investor_id: investorId,
          type: notificationType,
          title: title,
          message: message,
          read: false,
          created_at: new Date().toISOString()
        });
      }
    });

    // 2. Send email via edge function
    const { data: investor } = await supabase
      .from('investors')
      .select('full_name, email')
      .eq('id', investorId)
      .single();

    if (investor?.email) {
      await supabase.functions.invoke('send-notification-email', {
        body: {
          action: 'investor_notification',
          investor_id: investorId,
          investor_name: investor.full_name,
          investor_email: investor.email,
          notification_type: notificationType,
          title: title,
          message: message,
          subject: title,
          template: 'investor_update',
          portal_url: `${window.location.origin}/investor-login`
        }
      }).catch(() => {
        console.warn('[notifyInvestor] Email send failed, notification record still created');
      });
    }

    console.log(`[notifyInvestor] Notification created for investor ${investorId}: ${title}`);
  } catch (err) {
    console.error('[notifyInvestor] Error:', err);
  }
}
