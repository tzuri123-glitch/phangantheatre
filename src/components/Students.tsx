import { Student, CLASS_OPTIONS, isMonthlyPaymentType, getPaymentPrice } from '@/types';
import { format, isSameMonth, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useState } from 'react';
import { Users, MessageCircle, Copy, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface StudentsProps {
  students: Student[];
  payments: { studentId: string; amount: number; type: string; discount: number; date: string }[];
  onAddStudent: () => void;
  onEditStudent: (student: Student) => void;
  onDeleteStudent: (studentId: string) => void;
  onViewPayments?: (student: Student) => void;
}

export default function Students({ students, payments, onAddStudent, onEditStudent, onDeleteStudent, onViewPayments }: StudentsProps) {
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
  const [classSearchQueries, setClassSearchQueries] = useState<Record<string, string>>({});
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string; name: string } | null>(null);

  const toggleClass = (className: string) => {
    setExpandedClasses((prev) => ({
      ...prev,
      [className]: !prev[className],
    }));
  };

  const getStudentsByClass = (className: string) => {
    return students.filter(s => s.className === className);
  };

  const filterStudents = (className: string, classStudents: Student[]) => {
    const searchQuery = classSearchQueries[className] || '';
    if (searchQuery.length < 3) return classStudents;
    const query = searchQuery.toLowerCase();
    return classStudents.filter((student) => {
      return (
        student.name.toLowerCase().includes(query) ||
        student.lastName.toLowerCase().includes(query)
      );
    });
  };

  const MONTHLY_PRICE = 4000;
  const SIBLING_MONTHLY_PRICE = 3200;
  const SINGLE_PRICE = 700;
  const SIBLING_SINGLE_PRICE = 500;

  const calculateStudentBalance = (studentId: string, student: Student) => {
    const studentPayments = payments.filter(p => p.studentId === studentId);
    
    const totalPaid = studentPayments.reduce((sum, p) => sum + p.amount, 0);
    
    // קבוצת חודשים עם תשלום חודשי
    const monthsWithMonthlyPayment = new Set<string>();
    studentPayments
      .filter(p => p.type === 'חודשי')
      .forEach(p => {
        const monthKey = format(parseISO(p.date), 'MM/yyyy');
        monthsWithMonthlyPayment.add(monthKey);
      });
    
    let totalExpected = 0;
    
    studentPayments.forEach((payment) => {
      const paymentMonth = format(parseISO(payment.date), 'MM/yyyy');
      const discount = payment.discount || 0;
      
      if (payment.type === 'חודשי') {
        // תשלום חודשי
        const monthlyPrice = student.isSibling ? SIBLING_MONTHLY_PRICE : MONTHLY_PRICE;
        const priceAfterDiscount = monthlyPrice * (1 - discount / 100);
        totalExpected += priceAfterDiscount;
      } else if (payment.type === 'חד פעמי') {
        // תשלום חד-פעמי נספר רק אם אין תשלום חודשי באותו חודש
        if (!monthsWithMonthlyPayment.has(paymentMonth)) {
          const singlePrice = student.isSibling ? SIBLING_SINGLE_PRICE : SINGLE_PRICE;
          const priceAfterDiscount = singlePrice * (1 - discount / 100);
          totalExpected += priceAfterDiscount;
        }
        }
    });
    
    return totalPaid - totalExpected;
  };

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return 'bg-green-100 text-green-800'; // זכות
    if (balance < 0) return 'bg-red-100 text-red-800'; // חוב
    return 'bg-gray-100 text-gray-800'; // מאוזן
  };

  const getBalanceText = (balance: number) => {
    if (balance > 0) return `זכות ₪${balance}`;
    if (balance < 0) return `חוב ₪${Math.abs(balance)}`;
    return 'מאוזן';
  };

  const formatWhatsAppNumber = (phone: string) => {
    if (!phone) return '';

    // הסרת תווי כיווניות ותווים שאינם ספרות/+
    const sanitized = phone
      .replace(/[\u200E\u200F\u202A-\u202E]/g, '') // bidi marks
      .replace(/[\s\-().]/g, '');

    let num = sanitized;

    // נורמליזציה של קידומות
    if (num.startsWith('+')) {
      num = num.slice(1);
    } else if (num.startsWith('00')) {
      num = num.slice(2);
    } else {
      // מספר מקומי ישראלי
      const digits = num.replace(/\D/g, '');
      const local = digits.startsWith('0') ? digits.slice(1) : digits;
      num = '972' + local;
    }

    // תיקון למספרים ישראליים שנשמרו כ+9720...
    if (num.startsWith('9720')) {
      num = '972' + num.slice(4);
    }

    // שמירה על ספרות בלבד
    num = num.replace(/\D/g, '');

    return num;
  };

  const getWhatsAppUrl = (phone?: string) => {
    if (!phone) return '';
    const formatted = formatWhatsAppNumber(phone);
    if (!formatted) return '';

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

    // בדסקטופ נלך ישירות ל-web.whatsapp.com כדי להימנע מהפניה ל-api.whatsapp.com
    // במובייל נעדיף סכמת whatsapp:// לפתיחת האפליקציה, עם נפילה ל-wa.me אם הדפדפן לא תומך
    if (isMobile) {
      // ננסה לפתוח את האפליקציה, ואם לא, קישור רגיל יעבוד כגיבוי
      return `whatsapp://send?phone=${formatted}`;
    }
    return `https://web.whatsapp.com/send?phone=${formatted}`;
  };

  const getWhatsAppFallbackUrl = (phone?: string) => {
    if (!phone) return '';
    const formatted = formatWhatsAppNumber(phone);
    return formatted ? `https://wa.me/${formatted}` : '';
  };

  const openWhatsAppLink = (phone?: string) => {
    if (!phone) {
      toast.error('מספר טלפון לא תקין');
      return;
    }
    const formatted = formatWhatsAppNumber(phone);
    if (!formatted) {
      toast.error('מספר טלפון לא תקין');
      return;
    }

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

    if (isMobile) {
      const appUrl = `whatsapp://send?phone=${formatted}`;
      const fallback = `https://wa.me/${formatted}`;
      try {
        if (window.top) (window.top as Window).location.href = appUrl;
        else window.location.href = appUrl;
      } catch {
        window.location.href = appUrl;
      }
      setTimeout(() => {
        try {
          if (window.top) (window.top as Window).location.href = fallback;
          else window.location.href = fallback;
        } catch {
          window.location.href = fallback;
        }
      }, 700);
    } else {
      const webUrl = `https://web.whatsapp.com/send?phone=${formatted}`;
      try {
        if (window.top) (window.top as Window).location.href = webUrl;
        else window.location.href = webUrl;
      } catch {
        window.location.href = webUrl;
      }
    }
  };

  const copyWhatsAppLink = async (phone?: string) => {
    const url = getWhatsAppFallbackUrl(phone);
    if (!url) {
      toast.error('מספר טלפון לא תקין');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('קישור ווטסאפ הועתק!');
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast.success('קישור הועתק!'); } catch {}
      document.body.removeChild(ta);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl sm:text-3xl font-bold text-foreground">תלמידים</h2>
        <Button onClick={onAddStudent} size="sm" className="bg-magenta hover:bg-magenta-hover text-magenta-foreground text-xs sm:text-base px-3 sm:px-4">
          ➕ הוסף תלמיד
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CLASS_OPTIONS.map((className) => {
          const classStudents = getStudentsByClass(className);
          const studentCount = classStudents.length;
          
          return (
            <Card key={className} className="overflow-hidden">
              <div
                className="p-6 bg-accent cursor-pointer hover:bg-accent/80 transition-colors"
                onClick={() => toggleClass(className)}
              >
                <div className="flex items-center justify-between mb-2">
                  <Users className="text-primary" size={32} />
                  <span className="text-2xl font-bold text-primary">{studentCount}</span>
                </div>
                <h3 className="font-semibold text-lg text-foreground mb-1">{className}</h3>
                <p className="text-sm text-muted-foreground">
                  {studentCount === 0 ? 'אין תלמידים' : `${studentCount} תלמידים`}
                </p>
              </div>

              {expandedClasses[className] && studentCount > 0 && (
                <div className="border-t">
                  <div className="p-4 pb-2">
                    <Input
                      placeholder="חיפוש תלמיד..."
                      value={classSearchQueries[className] || ''}
                      onChange={(e) => setClassSearchQueries(prev => ({ ...prev, [className]: e.target.value }))}
                    />
                  </div>
                  
                  <div className="overflow-x-auto px-4 pb-4">
                    <Table className="min-w-full">
                     <TableHeader className="sticky top-0 bg-background z-10">
                       <TableRow>
                        <TableHead className="text-right">שם פרטי</TableHead>
                        <TableHead className="text-right">שם משפחה</TableHead>
                        <TableHead className="text-right">סטטוס</TableHead>
                        <TableHead className="text-right">מצב תשלום</TableHead>
                        <TableHead className="text-right">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filterStudents(className, classStudents).map((student) => {
                        const studentPaymentCount = payments.filter(p => p.studentId === student.id).length;
                        const balance = calculateStudentBalance(student.id, student);
                        
                        return (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Avatar
                                  className={`h-8 w-8 ${student.profilePhotoUrl ? 'cursor-pointer hover:ring-2 hover:ring-primary transition-all' : ''}`}
                                  onClick={() => {
                                    if (student.profilePhotoUrl) {
                                      setViewingPhoto({ url: student.profilePhotoUrl, name: `${student.name} ${student.lastName}` });
                                    }
                                  }}
                                >
                                  <AvatarImage src={student.profilePhotoUrl || undefined} alt={student.name} />
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {student.name?.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                {student.name}
                                  {(
                                    student.phone || student.parentPhone
                                  ) && (
                                    <>
                                      <Button
                                        asChild
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                      >
                                        <a
                                          href={getWhatsAppFallbackUrl(student.parentPhone || student.phone)}
                                          target="_top"
                                          rel="noopener noreferrer"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            openWhatsAppLink(student.parentPhone || student.phone);
                                          }}
                                          aria-label={`שליחת הודעה בווטסאפ ל${student.name}`}
                                        >
                                          <MessageCircle size={16} />
                                        </a>
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => copyWhatsAppLink(student.parentPhone || student.phone)}
                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-accent"
                                        aria-label={`העתק קישור ווטסאפ ל${student.name}`}
                                      >
                                        <Copy size={16} />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            <TableCell className="font-medium">{student.lastName}</TableCell>
                            <TableCell>
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-sm ${
                                  student.status === 'פעיל'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-orange-100 text-orange-800'
                                }`}
                              >
                                {student.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getBalanceColor(balance)}`}>
                                {getBalanceText(balance)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {onViewPayments && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onViewPayments(student)}
                                    title="תשלומים ויומן"
                                  >
                                    💳
                                  </Button>
                                 )}
                                {student.linkedEmail && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        const { error } = await supabase.functions.invoke('reset-student-password', {
                                          body: { studentEmail: student.linkedEmail },
                                        });
                                        if (error) throw error;
                                        toast.success(`מייל איפוס סיסמה נשלח ל-${student.linkedEmail}`);
                                      } catch (err: any) {
                                        toast.error('שגיאה: ' + err.message);
                                      }
                                    }}
                                    title="שלח מייל איפוס סיסמה"
                                  >
                                    <KeyRound size={14} />
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onEditStudent(student)}
                                >
                                  ✏️
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    if (studentPaymentCount > 0) {
                                      toast.error('לא ניתן למחוק תלמיד עם תשלומים קיימים');
                                      return;
                                    }
                                    onDeleteStudent(student.id);
                                  }}
                                >
                                  🗑️
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Photo viewer dialog */}
      <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
        <DialogContent className="max-w-md p-2" dir="rtl">
          {viewingPhoto && (
            <div className="text-center">
              <img
                src={viewingPhoto.url}
                alt={viewingPhoto.name}
                className="w-full max-h-[70vh] object-contain rounded-lg"
              />
              <p className="mt-3 font-bold text-foreground text-lg">{viewingPhoto.name}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
