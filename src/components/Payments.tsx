import { Payment, Student, CLASS_OPTIONS, Session, isMonthlyPaymentType, getPaymentPrice } from '@/types';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
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
import { useState } from 'react';
import { formatILS } from '@/lib/utils';


interface PaymentsProps {
  payments: Payment[];
  students: Student[];
  sessions: Session[];
  onAddPayment: () => void;
  onEditPayment: (payment: Payment) => void;
  onDeletePayment: (paymentId: string) => void;
}

export default function Payments({ payments, students, sessions, onAddPayment, onEditPayment, onDeletePayment }: PaymentsProps) {
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({});
  const [classSearchQueries, setClassSearchQueries] = useState<Record<string, string>>({});
  const [expandedSubscribers, setExpandedSubscribers] = useState(false);
  const [expandedOneTime, setExpandedOneTime] = useState(false);
  const [subscribersSearch, setSubscribersSearch] = useState('');
  const [oneTimeSearch, setOneTimeSearch] = useState('');

  const toggleClass = (className: string) => {
    setExpandedClasses((prev) => ({
      ...prev,
      [className]: !prev[className],
    }));
  };


  const toggleStudent = (studentId: string) => {
    setExpandedStudents((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  // קיבוץ תלמידים ותשלומים לפי חוג
  const getClassData = (className: string) => {
    const classStudents = students.filter(s => s.className === className);
    
    const studentPayments = classStudents.map((student) => {
      const studentPaymentsList = payments.filter((p) => p.studentId === student.id);
      const totalPaid = studentPaymentsList.reduce((sum, p) => sum + p.amount, 0);
      
      // קבוצת חודשים עם תשלום חודשי
      const monthsWithMonthlyPayment = new Set<string>();
      studentPaymentsList
        .filter(p => isMonthlyPaymentType(p.type))
        .forEach(p => {
          const monthKey = format(parseISO(p.date), 'MM/yyyy');
          monthsWithMonthlyPayment.add(monthKey);
        });
      
      let totalExpected = 0;
      const monthlyPrice = student.isSibling ? 3200 : 4000;
      
      studentPaymentsList.forEach((payment) => {
        const paymentMonth = format(parseISO(payment.date), 'MM/yyyy');
        const discount = payment.discount || 0;
        
        if (payment.type === 'סגירת יתרה') {
          // סגירת יתרה לא מייצרת צפי - הסכום הוא מה שהתקבל
        } else if (payment.type === 'חודשי') {
          const priceAfterDiscount = monthlyPrice * (1 - discount / 100);
          totalExpected += priceAfterDiscount;
        } else if (payment.type === 'חד פעמי') {
          if (!monthsWithMonthlyPayment.has(paymentMonth)) {
            const singlePrice = student.isSibling ? 500 : 600;
            const priceAfterDiscount = singlePrice * (1 - discount / 100);
            totalExpected += priceAfterDiscount;
          }
        }
      });
      
      const balance = totalPaid - totalExpected;
      
      return {
        student,
        payments: studentPaymentsList,
        totalPaid,
        totalExpected,
        balance,
      };
    }).filter(sp => sp.payments.length > 0);

    const totalClassIncome = studentPayments.reduce((sum, sp) => sum + sp.totalPaid, 0);
    
    return { studentPayments, totalClassIncome, studentCount: studentPayments.length };
  };

  const filterStudentPayments = (className: string, studentPayments: ReturnType<typeof getClassData>['studentPayments']) => {
    const searchQuery = classSearchQueries[className] || '';
    if (searchQuery.length < 3) return studentPayments;
    const query = searchQuery.toLowerCase();
    return studentPayments.filter(({ student }) => {
      return (
        student.name.toLowerCase().includes(query) ||
        student.lastName.toLowerCase().includes(query)
      );
    });
  };

  // פונקציה לחלוקת תלמידים למנויים וחד פעמיים
  const getSubscriptionCategories = () => {
    // תלמידים עם לפחות תשלום אחד
    const activeStudents = students.filter(student => 
      payments.some(p => p.studentId === student.id)
    );

    const subscribers: Student[] = [];
    const oneTimePayersOnly: Student[] = [];

    activeStudents.forEach(student => {
      const studentPayments = payments.filter(p => p.studentId === student.id);
      const hasMonthlyPayment = studentPayments.some(p => p.type === 'חודשי');
      
      if (hasMonthlyPayment) {
        subscribers.push(student);
      } else {
        oneTimePayersOnly.push(student);
      }
    });

    return { subscribers, oneTimePayersOnly };
  };

  const { subscribers, oneTimePayersOnly } = getSubscriptionCategories();

  const filterStudentsList = (studentsList: Student[], searchQuery: string) => {
    if (searchQuery.length < 3) return studentsList;
    const query = searchQuery.toLowerCase();
    return studentsList.filter(student => 
      student.name.toLowerCase().includes(query) ||
      student.lastName.toLowerCase().includes(query)
    );
  };

  const formatWhatsAppNumber = (phone: string) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '972' + cleaned.substring(1);
    } else if (!cleaned.startsWith('972')) {
      cleaned = '972' + cleaned;
    }
    return cleaned;
  };

  const openWhatsAppLink = (phone: string) => {
    if (!phone) return;
    const whatsappNumber = formatWhatsAppNumber(phone);
    const message = encodeURIComponent('שלום! אשמח לדבר איתך על מעבר למנוי חודשי');
    const url = `https://wa.me/${whatsappNumber}?text=${message}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl sm:text-3xl font-bold text-foreground">תשלומים</h2>
        <Button onClick={onAddPayment} size="sm" className="bg-magenta hover:bg-magenta-hover text-magenta-foreground text-xs sm:text-base px-3 sm:px-4">
          ➕ הוסף תשלום
        </Button>
      </div>

      {/* סקשן מנויים וחד פעמיים */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* מנויים */}
        <Card className="overflow-hidden">
          <div
            className="p-6 bg-emerald-200 dark:bg-emerald-800/40 cursor-pointer hover:bg-emerald-300 dark:hover:bg-emerald-700/50 transition-colors"
            onClick={() => setExpandedSubscribers(!expandedSubscribers)}
          >
            <h3 className="font-semibold text-lg text-foreground mb-1">💎 מנויים חודשיים</h3>
            <p className="text-sm text-muted-foreground">
              {subscribers.length} תלמידים עם מנוי
            </p>
          </div>

          {expandedSubscribers && (
            <div className="p-4 border-t">
              <div className="mb-4">
                <Input
                  placeholder="חיפוש תלמיד..."
                  value={subscribersSearch}
                  onChange={(e) => setSubscribersSearch(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                {filterStudentsList(subscribers, subscribersSearch).map(student => (
                  <Card key={student.id} className="p-3 bg-muted">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-foreground">
                          {student.name} {student.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          🎭 {student.className}
                        </div>
                        {student.phone && (
                          <div className="text-sm text-muted-foreground">
                            📱 {student.phone}
                          </div>
                        )}
                        {student.parentPhone && (
                          <div className="text-sm text-muted-foreground">
                            👨‍👩‍👧 {student.parentPhone} ({student.parentName || 'הורה'})
                          </div>
                        )}
                      </div>
                      {(student.phone || student.parentPhone) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-green-50 hover:bg-green-100 dark:bg-green-900/10 dark:hover:bg-green-900/20"
                          onClick={() => openWhatsAppLink(student.parentPhone || student.phone)}
                        >
                          💬 WhatsApp
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
                {filterStudentsList(subscribers, subscribersSearch).length === 0 && (
                  <div className="text-center text-muted-foreground py-4">
                    אין תוצאות
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* חד פעמיים */}
        <Card className="overflow-hidden">
          <div
            className="p-6 bg-rose-200 dark:bg-rose-800/40 cursor-pointer hover:bg-rose-300 dark:hover:bg-rose-700/50 transition-colors"
            onClick={() => setExpandedOneTime(!expandedOneTime)}
          >
            <h3 className="font-semibold text-lg text-foreground mb-1">🎯 תשלומים חד פעמיים</h3>
            <p className="text-sm text-muted-foreground">
              {oneTimePayersOnly.length} תלמידים (פוטנציאל למנוי!)
            </p>
          </div>

          {expandedOneTime && (
            <div className="p-4 border-t">
              <div className="mb-4">
                <Input
                  placeholder="חיפוש תלמיד..."
                  value={oneTimeSearch}
                  onChange={(e) => setOneTimeSearch(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                {filterStudentsList(oneTimePayersOnly, oneTimeSearch).map(student => (
                  <Card key={student.id} className="p-3 bg-muted">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-foreground">
                          {student.name} {student.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          🎭 {student.className}
                        </div>
                        {student.phone && (
                          <div className="text-sm text-muted-foreground">
                            📱 {student.phone}
                          </div>
                        )}
                        {student.parentPhone && (
                          <div className="text-sm text-muted-foreground">
                            👨‍👩‍👧 {student.parentPhone} ({student.parentName || 'הורה'})
                          </div>
                        )}
                      </div>
                      {(student.phone || student.parentPhone) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/10 dark:hover:bg-rose-900/20"
                          onClick={() => openWhatsAppLink(student.parentPhone || student.phone)}
                        >
                          💬 WhatsApp
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
                {filterStudentsList(oneTimePayersOnly, oneTimeSearch).length === 0 && (
                  <div className="text-center text-muted-foreground py-4">
                    אין תוצאות
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* תשלומים לפי חוגים */}
      <h3 className="text-2xl font-bold text-foreground mt-8">תשלומים לפי חוגים</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CLASS_OPTIONS.map((className) => {
          const { studentPayments, totalClassIncome, studentCount } = getClassData(className);
          
          return (
            <Card key={className} className="overflow-hidden">
              <div
                className="p-6 bg-accent cursor-pointer hover:bg-accent/80 transition-colors"
                onClick={() => toggleClass(className)}
              >
                <h3 className="font-semibold text-lg text-foreground mb-1">{className}</h3>
                <p className="text-sm text-muted-foreground">
                  {studentCount === 0 ? 'אין תשלומים' : `${studentCount} תלמידים`}
                </p>
              </div>

              {expandedClasses[className] && studentCount > 0 && (
                <div className="p-4 border-t">
                  <div className="mb-4">
                    <Input
                      placeholder="חיפוש תלמיד..."
                      value={classSearchQueries[className] || ''}
                      onChange={(e) => setClassSearchQueries(prev => ({ ...prev, [className]: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    {filterStudentPayments(className, studentPayments).map(({ student, payments: studentPaymentsList, totalPaid, totalExpected, balance }) => {
                      return (
                        <Card key={student.id} className="overflow-hidden">
                          <div
                            className="p-3 bg-muted cursor-pointer hover:bg-muted/80 transition-colors flex justify-between items-center"
                            onClick={() => toggleStudent(student.id)}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-sm text-foreground">
                                {student.name} {student.lastName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {studentPaymentsList.length} תשלומים
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-left">
                                <div className="font-bold text-primary text-sm">
                                  {formatILS(totalPaid)}
                                </div>
                                {balance !== 0 && (
                                  <div className={`text-xs font-medium ${balance < 0 ? 'text-red-500' : 'text-yellow-500'}`}>
                                    {balance < 0 ? `חוב: ${formatILS(Math.abs(balance))}` : `יתרה: ${formatILS(balance)}`}
                                  </div>
                                )}
                              </div>
                              <span className="text-xl">{expandedStudents[student.id] ? '▴' : '▾'}</span>
                            </div>
                          </div>

                        {expandedStudents[student.id] && (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-right">תאריך</TableHead>
                                <TableHead className="text-right">סוג</TableHead>
                                <TableHead className="text-right">אמצעי</TableHead>
                                <TableHead className="text-right">הנחה</TableHead>
                                <TableHead className="text-right">סכום שהתקבל</TableHead>
                                <TableHead className="text-right">הערה</TableHead>
                                <TableHead className="text-right">פעולות</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {studentPaymentsList.map((payment) => (
                                <TableRow key={payment.id}>
                                  <TableCell className="text-sm">{payment.date}</TableCell>
                                  <TableCell>
                                    <span className="inline-block px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                                      {payment.type}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-sm">{payment.method}</TableCell>
                                  <TableCell>
                                    {payment.discount ? (
                                      <span className="text-yellow-600 font-medium text-sm">{payment.discount}%</span>
                                    ) : (
                                      <span className="text-muted-foreground text-sm">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="font-bold text-primary text-sm">
                                    {formatILS(payment.amount)}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground text-sm">{payment.note}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-2">
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => onEditPayment(payment)}
                                      >
                                        ✏️
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => onDeletePayment(payment.id)}
                                        className="text-destructive hover:text-destructive"
                                      >
                                        🗑️
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
