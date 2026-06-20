import { supabase } from '@/lib/supabase';

/**
 * Email notification utility for sending investor notifications
 * Calls edge functions to trigger email delivery
 */

interface EmailNotificationOptions {
  investorId: string;
  investorName: string;
  investorEmail: string;
  staffName?: string;
}

/**
 * Send email notification when a new agreement is sent for signature
 */
export async function notifyAgreementSent(
  options: EmailNotificationOptions & {
    documentName: string;
    documentType: string;
    expiresInDays: number;
  }
) {
  try {
    const { data, error } = await supabase.functions.invoke('send-notification-email', {
      body: {
        action: 'agreement_sent',
        investor_id: options.investorId,
        investor_name: options.investorName,
        investor_email: options.investorEmail,
        document_name: options.documentName,
        document_type: options.documentType,
        expires_in_days: options.expiresInDays,
        staff_name: options.staffName || 'AYP Team',
        portal_url: `${window.location.origin}/investor-login`,
        subject: `Action Required: ${options.documentName} - Ready for Your Signature`,
        template: 'agreement_signature_request'
      }
    });
    
    if (error) {
      console.warn('Edge function error for agreement notification:', error);
      // Fallback: try investor-messaging edge function
      return await fallbackNotification(options, 'new_agreement', 
        `A new agreement "${options.documentName}" has been sent to you for signature. Please log in to your investor portal to review and sign.`
      );
    }
    
    return { success: true, emailSent: data?.email_sent || data?.success };
  } catch (err) {
    console.warn('Agreement notification failed, trying fallback:', err);
    return await fallbackNotification(options, 'new_agreement',
      `A new agreement "${options.documentName}" has been sent to you for signature. Please log in to your investor portal to review and sign.`
    );
  }
}

/**
 * Send email notification when new documents are uploaded to investor portal
 */
export async function notifyDocumentUploaded(
  options: EmailNotificationOptions & {
    documentName: string;
    documentType: string;
  }
) {
  try {
    const { data, error } = await supabase.functions.invoke('send-notification-email', {
      body: {
        action: 'document_uploaded',
        investor_id: options.investorId,
        investor_name: options.investorName,
        investor_email: options.investorEmail,
        document_name: options.documentName,
        document_type: options.documentType,
        staff_name: options.staffName || 'AYP Team',
        portal_url: `${window.location.origin}/investor-login`,
        subject: `New Document Available: ${options.documentName}`,
        template: 'document_uploaded'
      }
    });
    
    if (error) {
      console.warn('Edge function error for document notification:', error);
      return await fallbackNotification(options, 'new_document',
        `A new document "${options.documentName}" has been uploaded to your portal. Log in to view and download it.`
      );
    }
    
    return { success: true, emailSent: data?.email_sent || data?.success };
  } catch (err) {
    console.warn('Document notification failed, trying fallback:', err);
    return await fallbackNotification(options, 'new_document',
      `A new document "${options.documentName}" has been uploaded to your portal. Log in to view and download it.`
    );
  }
}

/**
 * Send email notification when staff sends a new message to investor
 */
export async function notifyNewMessage(
  options: EmailNotificationOptions & {
    messageSubject: string;
    messagePreview: string;
  }
) {
  try {
    const { data, error } = await supabase.functions.invoke('send-notification-email', {
      body: {
        action: 'new_message',
        investor_id: options.investorId,
        investor_name: options.investorName,
        investor_email: options.investorEmail,
        message_subject: options.messageSubject,
        message_preview: options.messagePreview.substring(0, 200),
        staff_name: options.staffName || 'AYP Team',
        portal_url: `${window.location.origin}/investor-login`,
        subject: `New Message from ${options.staffName || 'Your AYP Team'}: ${options.messageSubject}`,
        template: 'new_message'
      }
    });
    
    if (error) {
      console.warn('Edge function error for message notification:', error);
      return await fallbackNotification(options, 'new_message',
        `You have a new message from ${options.staffName || 'your AYP team'}. Subject: "${options.messageSubject}". Log in to your portal to read and reply.`
      );
    }
    
    return { success: true, emailSent: data?.email_sent || data?.success };
  } catch (err) {
    console.warn('Message notification failed, trying fallback:', err);
    return await fallbackNotification(options, 'new_message',
      `You have a new message from ${options.staffName || 'your AYP team'}. Subject: "${options.messageSubject}". Log in to your portal to read and reply.`
    );
  }
}

/**
 * Fallback notification using investor-messaging edge function
 * This sends a platform message + attempts email via the messaging system
 */
async function fallbackNotification(
  options: EmailNotificationOptions,
  type: string,
  message: string
) {
  try {
    // Try to send via the investor-messaging edge function which has email capability
    const { data, error } = await supabase.functions.invoke('investor-messaging', {
      body: {
        action: 'send_to_investor',
        investor_id: options.investorId,
        message: message,
        subject: `Notification: ${type.replace(/_/g, ' ')}`,
        staff_name: options.staffName || 'AYP System',
        send_email: true
      }
    });
    
    if (!error && data) {
      return { success: true, emailSent: data.email_sent || false, fallback: true };
    }
  } catch (e) {
    console.warn('Fallback notification also failed:', e);
  }
  
  // Last resort: try to create a notification record directly
  try {
    await supabase.from('investor_notifications').insert({
      investor_id: options.investorId,
      type: type,
      title: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      message: message,
      read: false,
      created_at: new Date().toISOString()
    });
    return { success: true, emailSent: false, fallback: true, notificationOnly: true };
  } catch {
    return { success: false, emailSent: false };
  }
}
