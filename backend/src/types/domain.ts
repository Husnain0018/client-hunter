export type Priority = 'high' | 'medium' | 'low';
export type RunStatus = 'queued' | 'running' | 'done' | 'error';
export type WebsiteStatus = 'Good' | 'Needs Improvement' | 'Poor' | 'No Website' | 'Not Loading' | 'Unverified';
export type SocialStatus = 'Active' | 'Slow' | 'Inactive' | 'Not checked' | 'No public posts found';
export type WhatsAppStatus = 'Sending' | 'Pending' | 'Sent' | 'Delivered' | 'Read' | 'Played' | 'Failed' | 'Unconfirmed';
export type LocationStatus = 'Verified' | 'City Match (Unverified Locality)' | 'Mismatch';

export interface ProblemFinding {
  type: 'confirmed' | 'potential';
  category: 'website' | 'response' | 'social' | 'reputation' | 'booking' | 'information';
  title: string;
  detail: string;
  evidence?: string;
}

export interface OutreachStrategy {
  overview: string;
  problems: ProblemFinding[];
  businessImpact: string[];
  relevantServices: string[];
  solutions: Array<{
    service: string;
    howItWorks: string;
    impact: string;
    estimatedTimeline: string;
  }>;
  conversationGuidance: {
    icebreaker: string;
    discoveryQuestions: string[];
    objectionHandling: string[];
  };
  nextSteps: string[];
}

export interface CustomService {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface LeadStats {
  totalUniqueLeads: number;
  totalRuns: number;
  verifiedLeads: number;
  leadsWithEmail: number;
  leadsWithPhone: number;
  noWebsiteLeads: number;
}

export interface SearchRequest {
  userName: string;
  company: string;
  senderType?: 'auto' | 'person' | 'company';
  userEmail: string;
  userPhone?: string;
  portfolio?: string;
  services: string[];
  niche: string;
  area: string;
  country: string;
  maxLeads: number;
  checkSocial: boolean;
  emailSummary: boolean;
}

export interface Competitor {
  name: string;
  rating: number | string;
  reviews: number;
  hasWebsite: boolean;
  website?: string;
}

export interface SocialProfile {
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  twitter?: string;
  youtube?: string;
  tiktok?: string;
}

export interface SocialActivity {
  status: SocialStatus;
  url: string;
  lastPost: string;
  daysInactive: number | null;
}

export interface WebsiteAudit {
  hasWebsite: boolean;
  reachable: boolean;
  score: number | null;
  status: WebsiteStatus;
  issues: string[];
  images: string[];
  techStack: string[];
  emails: string[];
  phones: string[];
  social: SocialProfile;
  title: string;
  metaDescription: string;
  httpStatus: number | null;
}

export interface Lead {
  runId: string;
  leadId: string;
  businessName: string;
  category: string;
  leadType: 'Has Website' | 'No Website';
  contactChannel: string;
  website: string;
  email: string;
  phone: string;
  whatsappLink: string;
  address: string;
  country: string;
  googleRating: number | string;
  googleReviews: number;
  googleMapsUrl: string;
  locationStatus?: LocationStatus;
  locationVerified?: boolean;
  leadScore: number;
  priority: Priority;
  estimatedDealValue: string;
  recommendedServices: string[];
  weaknesses: string[];
  analysisSummary: string;
  strategy?: OutreachStrategy;
  websiteScore: number | null;
  websiteStatus: WebsiteStatus;
  websiteIssues: string[];
  websiteImages: string[];
  techStack: string[];
  social: SocialProfile;
  socialActivity: Record<string, SocialActivity>;
  socialStatus: string;
  competitors: Competitor[];
  emailSubject: string;
  emailBodyText: string;
  emailBodyHtml: string;
  whatsappMessage: string;
  approvalStatus: 'Pending Review' | 'No Email' | 'Sent';
  emailStatus: 'Draft' | 'No Email' | 'Sent';
  responseStatus: 'No Reply' | 'Replied' | 'Won' | 'Lost';
  senderName: string;
  searchQuery: string;
  createdAt: string;
  emailSentAt: string;
  followUp1Date: string;
  followUp2Date: string;
  gmailThreadId: string;
  whatsappStatus?: WhatsAppStatus | 'Not sent';
  whatsappRunId?: string;
}

export interface RunEvent {
  seq: number;
  runId: string;
  type: 'stage' | 'lead' | 'done' | 'error';
  stage: 'start' | 'maps' | 'websites' | 'social' | 'final' | 'done';
  level: 'info' | 'warn' | 'error';
  message: string;
  payload?: unknown;
  createdAt: string;
}

export interface RunRecord {
  runId: string;
  status: RunStatus;
  request: SearchRequest;
  message: string;
  total: number;
  createdAt: string;
  completedAt: string | null;
}

export interface WhatsAppRecord {
  leadId: string;
  businessName: string;
  number: string;
  status: WhatsAppStatus;
  message: string;
  providerMessageId: string;
  savedAt: string;
  updatedAt: string;
  error: string;
}

export type ClientStage =
  | 'new'
  | 'contacted'
  | 'awaiting_reply'
  | 'conversing'
  | 'follow_up_scheduled'
  | 'interested'
  | 'proposal_pending'
  | 'negotiating'
  | 'closed_won'
  | 'lost'
  | 'opted_out'
  | 'needs_human';

export interface ConversationMessage {
  id: string;
  leadId: string;
  sender: 'client' | 'assistant' | 'user';
  text: string;
  timestamp: string;
  status: WhatsAppStatus;
  providerMessageId?: string;
  metadata?: Record<string, unknown>;
}

export interface ClientConversation {
  leadId: string;
  businessName: string;
  phone: string;
  stage: ClientStage;
  autoPilot: boolean;
  agreedServices: string[];
  agreedPrice: string;
  agreedTimeline: string;
  agreedDeliverables: string;
  dealNotes: string;
  closedAt?: string | null;
  closingNotifiedAt?: string | null;
  humanInterventionReason: string;
  nextFollowUpAt?: string | null;
  followUpCount: number;
  optedOut: boolean;
  summary: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  lead?: Lead;
  messages?: ConversationMessage[];
}

export interface ClientHandlerStats {
  totalClients: number;
  newLeads: number;
  awaitingReply: number;
  activeConversations: number;
  negotiating: number;
  closedWon: number;
  needsHuman: number;
  optedOut: number;
}

export interface DealClosingInfo {
  leadId: string;
  businessName?: string;
  agreedServices: string[];
  agreedPrice: string;
  agreedTimeline: string;
  agreedDeliverables: string;
  dealNotes?: string;
  notifyUserWhatsApp?: boolean;
  userPhoneNumber?: string;
}
