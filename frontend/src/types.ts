export type Priority = 'high' | 'medium' | 'low';
export type RunStatus = 'queued' | 'running' | 'done' | 'error';
export type WhatsAppStatus = 'Sending' | 'Pending' | 'Sent' | 'Delivered' | 'Read' | 'Played' | 'Failed' | 'Unconfirmed' | 'Not sent';
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

export interface SearchForm {
  userName: string;
  company: string;
  senderType?: 'auto' | 'person' | 'company';
  userEmail: string;
  userPhone: string;
  portfolio: string;
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

export interface SocialActivity {
  status: string;
  url: string;
  lastPost: string;
  daysInactive: number | null;
}

export interface Lead {
  runId: string;
  leadId: string;
  businessName: string;
  category: string;
  leadType: string;
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
  websiteStatus: string;
  websiteIssues: string[];
  websiteImages: string[];
  techStack: string[];
  social: Record<string, string>;
  socialActivity: Record<string, SocialActivity>;
  socialStatus: string;
  competitors: Competitor[];
  emailSubject: string;
  emailBodyText: string;
  emailBodyHtml: string;
  whatsappMessage: string;
  approvalStatus: string;
  emailStatus: string;
  responseStatus: string;
  senderName: string;
  searchQuery: string;
  createdAt: string;
  emailSentAt: string;
  followUp1Date: string;
  followUp2Date: string;
  gmailThreadId: string;
  whatsappStatus?: WhatsAppStatus;
  whatsappRunId?: string;
}

export interface Run {
  runId: string;
  status: RunStatus;
  request: SearchForm;
  message: string;
  total: number;
  createdAt: string;
  completedAt: string | null;
  leads: Lead[];
}

export interface RunEvent {
  seq: number;
  runId: string;
  type: 'stage' | 'lead' | 'done' | 'error';
  stage: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  payload?: unknown;
  createdAt: string;
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
