import { supabase } from '@/lib/supabase';

export type ActivityType = 
  | 'login'
  | 'logout'
  | 'deal_view'
  | 'inquiry_submitted'
  | 'document_download'
  | 'message_sent'
  | 'message_read'
  | 'favorite_added'
  | 'favorite_removed'
  | 'profile_updated'
  | 'report_viewed'
  | 'search_performed'
  | 'account_created'
  | 'password_reset'
  | 'password_reset_requested'
  | 'onboarding_completed'
  | 'call_booked'
  | 'document_uploaded'
  | 'referral_sent';

export type ActivityCategory = 
  | 'authentication'
  | 'deals'
  | 'inquiries'
  | 'documents'
  | 'messaging'
  | 'account'
  | 'reports'
  | 'referrals';

interface LogActivityParams {
  investorId: string;
  activityType: ActivityType;
  activityCategory: ActivityCategory;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
}

export async function logActivity({
  investorId,
  activityType,
  activityCategory,
  title,
  description,
  metadata
}: LogActivityParams): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('investor-activity-log', {
      body: {
        action: 'log',
        investor_id: investorId,
        activity_type: activityType,
        activity_category: activityCategory,
        title,
        description,
        metadata
      }
    });

    if (error) {
      console.error('Failed to log activity:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Activity logging error:', err);
    return false;
  }
}

// Convenience functions for common activities
export const logDealView = (investorId: string, dealData: { id: string; address?: string; city?: string; state?: string }) => {
  return logActivity({
    investorId,
    activityType: 'deal_view',
    activityCategory: 'deals',
    title: 'Viewed Deal',
    description: dealData.address ? `Viewed property at ${dealData.address}, ${dealData.city}, ${dealData.state}` : 'Viewed a property listing',
    metadata: { property_id: dealData.id, address: dealData.address, city: dealData.city, state: dealData.state }
  });
};

export const logInquirySubmitted = (investorId: string, propertyData: { id: string; address?: string; city?: string; state?: string }) => {
  return logActivity({
    investorId,
    activityType: 'inquiry_submitted',
    activityCategory: 'inquiries',
    title: 'Submitted Inquiry',
    description: propertyData.address ? `Submitted inquiry for ${propertyData.address}, ${propertyData.city}, ${propertyData.state}` : 'Submitted a property inquiry',
    metadata: { property_id: propertyData.id, address: propertyData.address }
  });
};

export const logDocumentDownload = (investorId: string, documentData: { id: string; name: string; type?: string }) => {
  return logActivity({
    investorId,
    activityType: 'document_download',
    activityCategory: 'documents',
    title: 'Downloaded Document',
    description: `Downloaded "${documentData.name}"`,
    metadata: { document_id: documentData.id, document_name: documentData.name, document_type: documentData.type }
  });
};

export const logMessageSent = (investorId: string, messageData: { subject?: string; recipient?: string }) => {
  return logActivity({
    investorId,
    activityType: 'message_sent',
    activityCategory: 'messaging',
    title: 'Sent Message',
    description: messageData.subject ? `Sent message: "${messageData.subject}"` : 'Sent a message to the team',
    metadata: { subject: messageData.subject, recipient: messageData.recipient }
  });
};

export const logFavoriteAdded = (investorId: string, dealData: { id: string; address?: string; city?: string; state?: string }) => {
  return logActivity({
    investorId,
    activityType: 'favorite_added',
    activityCategory: 'deals',
    title: 'Saved Deal',
    description: dealData.address ? `Saved ${dealData.address}, ${dealData.city}, ${dealData.state} to favorites` : 'Saved a property to favorites',
    metadata: { property_id: dealData.id, address: dealData.address }
  });
};

export const logFavoriteRemoved = (investorId: string, dealData: { id: string; address?: string }) => {
  return logActivity({
    investorId,
    activityType: 'favorite_removed',
    activityCategory: 'deals',
    title: 'Removed from Favorites',
    description: dealData.address ? `Removed ${dealData.address} from favorites` : 'Removed a property from favorites',
    metadata: { property_id: dealData.id }
  });
};

export const logReportViewed = (investorId: string, reportData: { id: string; title: string; market?: string }) => {
  return logActivity({
    investorId,
    activityType: 'report_viewed',
    activityCategory: 'reports',
    title: 'Viewed Market Report',
    description: `Viewed report: "${reportData.title}"`,
    metadata: { report_id: reportData.id, report_title: reportData.title, market: reportData.market }
  });
};

export const logSearchPerformed = (investorId: string, searchData: { query?: string; filters?: Record<string, any>; results_count?: number }) => {
  return logActivity({
    investorId,
    activityType: 'search_performed',
    activityCategory: 'deals',
    title: 'Performed Search',
    description: searchData.query ? `Searched for "${searchData.query}"` : 'Performed a property search',
    metadata: { query: searchData.query, filters: searchData.filters, results_count: searchData.results_count }
  });
};

export const logCallBooked = (investorId: string, callData: { date?: string; time?: string; type?: string; property_id?: string }) => {
  return logActivity({
    investorId,
    activityType: 'call_booked',
    activityCategory: 'inquiries',
    title: 'Booked Discovery Call',
    description: callData.date ? `Scheduled call for ${callData.date} at ${callData.time}` : 'Scheduled a discovery call',
    metadata: { scheduled_date: callData.date, scheduled_time: callData.time, call_type: callData.type, property_id: callData.property_id }
  });
};

export const logOnboardingCompleted = (investorId: string) => {
  return logActivity({
    investorId,
    activityType: 'onboarding_completed',
    activityCategory: 'account',
    title: 'Completed Onboarding',
    description: 'Successfully completed the investor onboarding process'
  });
};

export const logReferralSent = (investorId: string, referralData: { referral_email: string; referral_name?: string }) => {
  return logActivity({
    investorId,
    activityType: 'referral_sent',
    activityCategory: 'referrals',
    title: 'Sent Referral',
    description: `Referred ${referralData.referral_name || referralData.referral_email}`,
    metadata: { referral_email: referralData.referral_email, referral_name: referralData.referral_name }
  });
};
