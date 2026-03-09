export interface Student {
  id: string;
  name: string;
  lastName: string;
  phone: string;
  birthDate: string;
  parentName: string;
  parentPhone: string;
  isSibling: boolean;
  siblingId?: string;
  className: string;
  status: 'פעיל' | 'בהקפאה';
  linkedEmail?: string;
  profilePhotoUrl?: string;
}

export interface Payment {
  id: string;
  studentId: string;
  type: 'חד פעמי' | 'חודשי דו שבועי' | 'חודשי חד שבועי' | 'סגירת יתרה';
  method: 'מזומן' | 'סקאן';
  date: string;
  amount: number;
  note: string;
  discount?: number;
  proofUrl?: string | null;
}

export interface SessionStudent {
  studentId: string;
  status: 'נוכח' | 'לא הגיע' | 'לא באי' | 'עזב' | '';
}

export interface Session {
  id: string;
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

// מחירון חדש
export const SINGLE_PRICE = 800;
export const SIBLING_SINGLE_PRICE = 700;
export const MONTHLY_BIWEEKLY_PRICE = 4200;
export const SIBLING_MONTHLY_BIWEEKLY_PRICE = 3800;
export const MONTHLY_WEEKLY_PRICE = 3000;
export const SIBLING_MONTHLY_WEEKLY_PRICE = 2400;

// Legacy exports for backward compatibility
export const MONTHLY_PRICE = MONTHLY_BIWEEKLY_PRICE;
export const SIBLING_MONTHLY_PRICE = SIBLING_MONTHLY_BIWEEKLY_PRICE;

// Helper to check if a payment type is monthly
export function isMonthlyPaymentType(type: string): boolean {
  return type === 'חודשי דו שבועי' || type === 'חודשי חד שבועי' || type === 'חודשי';
}

// Helper to get price for a payment type
export function getPaymentPrice(type: string, isSibling: boolean): number {
  switch (type) {
    case 'חד פעמי':
      return isSibling ? SIBLING_SINGLE_PRICE : SINGLE_PRICE;
    case 'חודשי דו שבועי':
      return isSibling ? SIBLING_MONTHLY_BIWEEKLY_PRICE : MONTHLY_BIWEEKLY_PRICE;
    case 'חודשי חד שבועי':
      return isSibling ? SIBLING_MONTHLY_WEEKLY_PRICE : MONTHLY_WEEKLY_PRICE;
    case 'חודשי': // legacy
      return isSibling ? SIBLING_MONTHLY_BIWEEKLY_PRICE : MONTHLY_BIWEEKLY_PRICE;
    default:
      return 0;
  }
}

// Check if monthly payment is within allowed window (25th prev month to 5th current month)
export function isWithinPaymentWindow(paymentDate: Date, targetMonth: Date): boolean {
  const year = targetMonth.getFullYear();
  const month = targetMonth.getMonth(); // 0-indexed
  
  // Window start: 25th of previous month
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const windowStart = new Date(prevYear, prevMonth, 25);
  windowStart.setHours(0, 0, 0, 0);
  
  // Window end: 5th of target month
  const windowEnd = new Date(year, month, 5, 23, 59, 59, 999);
  
  return paymentDate >= windowStart && paymentDate <= windowEnd;
}

// Check if payment is late (after the 5th)
export function isLatePayment(paymentDate: Date, targetMonth: Date): boolean {
  const year = targetMonth.getFullYear();
  const month = targetMonth.getMonth();
  const deadline = new Date(year, month, 5, 23, 59, 59, 999);
  
  return paymentDate > deadline;
}
