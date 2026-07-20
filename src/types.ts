export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  plan: "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
  role?: "USER" | "ADMIN";
  trialDaysElapsed?: number;
  isTrialActive?: boolean;
  trialStartDate?: string;
}

export interface CompanyProfile {
  id: string;
  userId: string;
  companyName: string;
  registrationNumber: string;
  gstNumber: string;
  panNumber: string;
  annualTurnover: number;
  yearsOfExperience: number;
  categories: string[];
  certifications: string[];
  states: string[];
  msmeRegistered: boolean;
  employeeCount: number;
  pastProjects: { name: string; value: number; client: string; year: number }[];
  isActive: boolean;
}

export interface Tender {
  id: string;
  externalId: string;
  sourcePortal: "CPPP" | "GEM" | "STATE_PWD" | "RAILWAYS" | "NHAI" | "DEFENSE" | "PSU" | "OTHER";
  title: string;
  department: string;
  state: string;
  category: string;
  subCategory: string;
  tenderValue: number | null;
  emdAmount: number | null;
  publishedDate: string;
  bidSubmissionDeadline: string;
  openingDate: string | null;
  workDescription: string;
  eligibilityCriteria: {
    minTurnover: number;
    minExperience: number;
    requiredCertifications: string[];
    msmeOnly: boolean;
    statesAllowed?: string[];
  };
  technicalSpecs: string | null;
  documents: { name: string; url: string; type: string }[];
  rawText: string;
  aiSummary: string | null;
  aiEligibilityChecklist: any | null;
  status: "ACTIVE" | "CLOSED" | "AWARDED" | "CANCELLED";
  location: string;
}

export interface TenderMatch {
  id: string;
  tenderId: string;
  companyProfileId: string;
  matchScore: number;
  matchBreakdown: {
    turnoverMatch: boolean;
    certMatch: boolean;
    categoryMatch: boolean;
    stateMatch: boolean;
    experienceMatch: boolean;
    missingItems: string[];
  };
  isBookmarked: boolean;
  userStatus: "NEW" | "REVIEWING" | "BIDDING" | "SUBMITTED" | "WON" | "LOST" | "SKIPPED";
  receiptNumber?: string | null;
  tender?: Tender;
}

export interface BidDocument {
  id: string;
  tenderId: string;
  companyProfileId: string;
  userId: string;
  type: "TECHNICAL_PROPOSAL" | "COVER_LETTER" | "COMPLIANCE_MATRIX" | "BOQ" | "FULL_BID_PACKAGE";
  content: string;
  s3Url: string | null;
  version: number;
  isAiGenerated: boolean;
  createdAt: string;
}

export interface DocumentVersion {
  versionNumber: number;
  fileName: string;
  s3Url: string;
  createdAt: string;
  ocrText?: string;
  metadata?: Record<string, string>;
}

export interface DocumentVault {
  id: string;
  companyProfileId: string;
  userId: string;
  documentType: "GST_CERTIFICATE" | "PAN_CARD" | "MSME_CERTIFICATE" | "ISO_CERTIFICATE" | "AUDITED_FINANCIALS" | "EXPERIENCE_CERTIFICATE" | "BANK_DETAILS" | "EMD_INSTRUMENT" | "OTHER";
  fileName: string;
  s3Url: string;
  expiryDate: string | null;
  isVerified: boolean;
  year: number | null;
  
  // Phase 7: Document Management System Support
  currentVersion?: number;
  versions?: DocumentVersion[];
  ocrText?: string;
  metadata?: Record<string, string>;
  aiSummary?: string;
  autoCategorized?: boolean;
}

export interface Alert {
  id: string;
  userId: string;
  tenderId: string;
  type: "NEW_MATCH" | "DEADLINE_REMINDER" | "STATUS_CHANGE" | "DOCUMENT_MISSING" | "SUBSCRIPTION_EVENT";
  channel: "EMAIL" | "WHATSAPP" | "SMS" | "IN_APP" | "PUSH";
  message: string;
  isRead: boolean;
  sentAt: string;
  createdAt: string;
  channelsDispatched?: {
    email?: { sent: boolean; destination: string; timestamp: string; subject?: string; content?: string };
    sms?: { sent: boolean; destination: string; timestamp: string; content?: string };
    whatsapp?: { sent: boolean; destination: string; timestamp: string; content?: string };
    push?: { sent: boolean; destination: string; timestamp: string; content?: string };
    in_app?: { sent: boolean; destination: string; timestamp: string; content?: string };
  };
}

export interface TenderQA {
  id: string;
  tenderId: string;
  userId: string;
  question: string;
  answer: string;
  sourceCitations: { text: string; pageNumber: number; section: string }[];
  createdAt: string;
}

export interface AnalyticsOverview {
  totalTendersMonitored: number;
  highActiveMatchesCount: number;
  bidsSubmittedCount: number;
  winRatePercentage: number;
}

export interface SupportTicketReply {
  sender: "USER" | "ADMIN";
  message: string;
  timestamp: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  subject: string;
  message: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: "BILLING" | "TECHNICAL" | "COMPLIANCE" | "OTHER";
  replies: SupportTicketReply[];
  createdAt: string;
  updatedAt: string;
}

export interface SystemSettings {
  liveGatewayActive: boolean;
  aiRateLimitPerMin: number;
  customServiceFeeMultiplier: number;
  sandboxMode: boolean;
  maintenanceMode: boolean;
}

export interface PaymentIntent {
  id: string;
  userId: string;
  planId: string;
  amount: number;
  billingCycle: "MONTHLY" | "ANNUAL";
  gateway: "CASHFREE" | "RAZORPAY";
  method: string;
  status: "CAPTURED" | "PENDING" | "FAILED";
  createdAt: string;
}

