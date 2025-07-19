export interface Note {
  id: string;
  text: string;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Attachment {
  id: string;
  fileName: string;
  dataUrl: string;
}

export interface Lead {
  id: string;
  userId?: string;
  title: string;
  description?: string;
  stageId: string;
  createdAt: string;
  stageChangedAt: string;
  notes?: Note[];
  checklist?: ChecklistItem[];
  attachments?: Attachment[];
}
