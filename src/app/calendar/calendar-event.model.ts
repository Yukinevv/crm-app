export interface ParticipantSnapshot {
  uid: string;
  name: string;
  email: string;
}

export interface ParticipantWithFlag extends ParticipantSnapshot {
  isLinked: boolean;
}

export interface CalendarEvent {
  id: string;
  userId?: string;                   // tylko spotkania mają userId
  title: string;
  participants: string[];            // oryginalne ID kontaktów twórcy
  invitedUserIds?: string[];         // UID zaproszonych użytkowników
  creatorName?: string;              // snapshot imienia twórcy
  participantsSnapshot?: ParticipantSnapshot[]; // snapshot uczestników
  location?: string;
  virtualLink?: string;
  start: string;
  end: string;
  allDay: boolean;
  reminderMinutesBefore?: number;
}

// Typ do tworzenia nowego wydarzenia (bez id i userId)
export type CreateEvent = Omit<CalendarEvent, 'id' | 'userId'>;

// Typ do aktualizacji wydarzenia (z id, bez userId)
export type UpdateEvent = CreateEvent & { id: string };
