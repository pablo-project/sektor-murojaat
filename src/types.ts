export type AppealStatus = 'yangi' | 'jarayonda' | 'hal_etildi' | 'vakolatda_emas';
export type FeedbackStatus = 'kutilmoqda' | 'roziman' | 'etirozli';

export interface Organization {
  id: string;
  name: string;
  code: string;
  category: string;
  phone: string;
  leader: string;
  password?: string;
  totalAppeals: number;
  resolvedAppeals: number;
  inProgressAppeals: number;
  objectionAppeals: number;
  rejectedAuthorityAppeals: number;
}

export interface Appeal {
  id: string;
  appealNumber: string;
  organizationId: string;
  organizationName: string;
  fullName: string;
  phone: string;
  address?: string;
  content: string;
  attachmentUrl?: string;
  category: string;
  createdAt: string;
  deadlineAt?: string;
  status: AppealStatus;
  assignedOperator?: string;
  startedAt?: string;
  resolutionText?: string;
  resolutionPhotoUrl?: string;
  resolvedAt?: string;
  feedback: FeedbackStatus;
  objectionText?: string;
  objectionAt?: string;
  aiCategory?: string;
  aiSuggestedResponse?: string;
  telegramChatId?: number;
}

export interface BotStatusInfo {
  isActive: boolean;
  botUsername?: string;
  botFirstName?: string;
}

export interface SystemStats {
  totalOrganizations: number;
  totalAppeals: number;
  resolvedCount: number;
  inProgressCount: number;
  objectionCount: number;
  rejectedAuthorityCount: number;
  satisfactionRate: number;
}
