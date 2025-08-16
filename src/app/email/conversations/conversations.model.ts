export type ConversationDirection = 'out' | 'in';

export interface Conversation {
  id: string;
  userId: string;
  type: 'email';
  direction: ConversationDirection;
  subject: string;
  preview?: string;
  date: string;
  emailId: string;
  contactId?: string;
  leadId?: string;
  counterpartEmail: string;
}
