import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatILS(value: number) {
  try {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `฿${value.toLocaleString('th-TH')}`;
  }
}

export function formatPhoneForWhatsApp(phone: string): string {
  // הסרת רווחים ומקפים
  const cleanPhone = phone.replace(/[\s-]/g, '');
  
  // בדיקה אם יש כבר קידומת
  if (cleanPhone.startsWith('+')) {
    return cleanPhone;
  }
  
  // אם אין קידומת, זה מספר ישראלי - מוסיפים +972
  if (cleanPhone.startsWith('0')) {
    return `+972${cleanPhone.substring(1)}`;
  }
  
  return `+972${cleanPhone}`;
}

export function createWhatsAppPaymentLink(
  parentPhone: string,
  studentName: string,
  amount: number,
  isSibling: boolean
): string {
  const formattedPhone = formatPhoneForWhatsApp(parentPhone);
  const siblingText = isSibling ? ' (מחיר אח)' : '';
  const message = `שלום,\n\nתזכורת לתשלום עבור ${studentName}${siblingText}:\nסכום: ${formatILS(amount)}\n\nניתן לשלוח צילום מסך של התשלום בתגובה להודעה זו.\n\nתודה!`;
  
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}
