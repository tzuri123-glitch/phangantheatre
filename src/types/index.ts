export interface Student {
  id: number;
  name: string;
  lastName: string;
  phone: string;
  birthDate: string;
  parentName: string;
  parentPhone: string;
  isSibling: boolean;
  className: string;
  status: 'חדש' | 'פעיל' | 'בהקפאה' | 'בהמתנה';
}

export interface Payment {
  id: number;
  studentId: number;
  type: 'ניסיון' | 'חד פעמי' | 'חודשי';
  method: 'מזומן' | 'סקאן';
  date: string;
  amount: number;
  note: string;
}

export interface SessionStudent {
  studentId: number;
  status: 'נוכח' | 'לא הגיע' | 'לא באי';
}

export interface Session {
  id: number;
  className: string;
  date: string;
  trial: boolean;
  students: SessionStudent[];
}

export const CLASS_OPTIONS = [
  "תיאטרון 7-9",
  "תיאטרון 10-14", 
  "תיאטרון נוער",
  "תיאטרון מבוגרים"
] as const;

export const MONTHLY_PRICE = 2800;
export const SIBLING_MONTHLY_PRICE = 2400;
export const SINGLE_PRICE = 800;
export const TRIAL_PRICE = 700;
