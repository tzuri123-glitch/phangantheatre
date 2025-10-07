import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatILS(value: number) {
  try {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      maximumFractionDigits: 0,
      currencyDisplay: 'narrowSymbol',
    }).format(value);
  } catch {
    return `₪${value.toLocaleString('he-IL')}`;
  }
}
