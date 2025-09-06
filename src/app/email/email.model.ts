export interface Email {
  id: string;
  userId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  isRead: boolean;
  messageId?: string;
  tags?: Record<string, string | number>;
}
