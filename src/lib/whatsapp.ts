// עזר משותף לשליחת הודעות בווטסאפ

export const formatWhatsAppNumber = (phone?: string | null): string => {
  if (!phone) return '';
  const sanitized = phone.trim();
  if (!sanitized) return '';

  let num = sanitized;

  if (num.startsWith('+')) {
    num = num.slice(1);
  } else if (num.startsWith('00')) {
    num = num.slice(2);
  } else {
    const digits = num.replace(/\D/g, '');
    const local = digits.startsWith('0') ? digits.slice(1) : digits;
    num = '972' + local;
  }

  if (num.startsWith('9720')) {
    num = '972' + num.slice(4);
  }

  return num.replace(/\D/g, '');
};

const isMobileDevice = () => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
};

/** פותח צ'אט ווטסאפ עם ההורה כשההודעה כבר מוכנה בתיבת הכתיבה */
export const openWhatsAppWithMessage = (phone?: string | null, message?: string): boolean => {
  const formatted = formatWhatsAppNumber(phone);
  if (!formatted) return false;

  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  const url = isMobileDevice()
    ? `https://wa.me/${formatted}${text}`
    : `https://web.whatsapp.com/send?phone=${formatted}${message ? `&text=${encodeURIComponent(message)}` : ''}`;

  try {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      if (window.top) (window.top as Window).location.href = url;
      else window.location.href = url;
    }
  } catch {
    window.location.href = url;
  }
  return true;
};
