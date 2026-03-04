import { useState, useEffect, useRef } from 'react';
import { Student, Payment, Session, CLASS_OPTIONS, MONTHLY_PRICE, SIBLING_MONTHLY_PRICE, SINGLE_PRICE } from '@/types';
import { getPaymentStatusForSession, getStatusColor, getStatusBadge } from '@/lib/paymentStatus';
import { Badge } from '@/components/ui/badge';
import TabNavigation from '@/components/TabNavigation';
import Dashboard from '@/components/Dashboard';
import Students from '@/components/Students';
import Payments from '@/components/Payments';
import Attendance from '@/components/Attendance';
import AdminSettings from '@/components/AdminSettings';
import PendingPayments from '@/components/PendingPayments';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatILS } from '@/lib/utils';
import logo from '@/assets/logo.png';

export default function Index() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState('dashboard');
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const studentFormRef = useRef<Student | null>(null);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [paymentForm, setPaymentForm] = useState<{ studentId: string; type: string; method: 'מזומן' | 'סקאן'; date: string; amount: number; note: string; discount: number }>({ studentId: '', type: '', method: 'מזומן', date: new Date().toISOString().slice(0, 10), amount: 0, note: '', discount: 0 });
  const [openStudentCombobox, setOpenStudentCombobox] = useState(false);
  const [studentSearchValue, setStudentSearchValue] = useState('');
  
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionForm, setSessionForm] = useState<{ className: string; date: string; trial: boolean }>({ className: CLASS_OPTIONS[0], date: new Date().toISOString().slice(0, 10), trial: false });
  const [currentSession, setCurrentSession] = useState<Session | null>(null);

  // טעינת נתונים מהדטהבייס
  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
      const { data: studentsData } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user.id);
      
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id);
      
      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id);
      
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id);
      
      if (studentsData) {
        // Get linked emails from profiles
        const authUserIds = studentsData
          .map(s => (s as any).auth_user_id)
          .filter(Boolean);
        
        let emailMap: Record<string, string> = {};
        if (authUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, email')
            .in('id', authUserIds);
          if (profiles) {
            profiles.forEach(p => { if (p.email) emailMap[p.id] = p.email; });
          }
        }

        setStudents(studentsData.map(s => ({
          id: s.id,
          name: s.name,
          lastName: s.last_name || '',
          phone: s.phone || '',
          birthDate: s.birth_date || '',
          parentName: s.parent_name || '',
          parentPhone: s.parent_phone || '',
          isSibling: s.is_sibling || false,
          siblingId: s.sibling_id || undefined,
          className: s.class_name,
          status: s.status as Student['status'],
          linkedEmail: (s as any).auth_user_id ? emailMap[(s as any).auth_user_id] || '' : undefined,
        })).sort((a, b) => a.name.localeCompare(b.name, 'he')));
      }
      
      if (paymentsData) {
        setPayments(paymentsData.map(p => ({
          id: p.id,
          studentId: p.student_id,
          type: p.payment_type as Payment['type'],
          method: p.payment_method as Payment['method'],
          date: p.payment_date,
          amount: Number(p.amount),
          note: p.note || '',
          discount: Number(p.discount) || 0
        })));
      }
      
      if (sessionsData) {
        setSessions(sessionsData.map(s => {
          const sessionAttendance = attendanceData?.filter(a => a.session_id === s.id) || [];
          return {
            id: s.id,
            className: s.class_name,
            date: s.session_date,
            trial: s.is_trial || false,
            students: sessionAttendance.map(a => ({
              studentId: a.student_id,
              status: a.status as 'נוכח' | 'לא הגיע' | 'לא באי'
            }))
          };
        }));
      }
    };
    
    loadData();
  }, [user]);

  function calcPayment(studentId: string, type: string, date: string) {
    const student = students.find((s) => s.id === studentId);
    if (!student) return { amount: 0, note: '' };
    
    // Parser עמיד לפורמטים שונים (YYYY-MM-DD וגם DD.MM[.YYYY])
    const parseDate = (s: string) => {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
      const m = s.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?$/);
      if (m) {
        const dd = Number(m[1]);
        const mm = Number(m[2]) - 1;
        const yyRaw = m[3];
        const yyyy = yyRaw ? (yyRaw.length === 2 ? 2000 + Number(yyRaw) : Number(yyRaw)) : new Date().getFullYear();
        return new Date(yyyy, mm, dd);
      }
      return new Date(NaN);
    };

    const currDate = parseDate(date);
    
    // חישוב יתרת התלמיד (זכות/חוב) מכל התשלומים הקודמים
    const studentPayments = payments.filter((p) => {
      if (p.studentId !== studentId) return false;
      const pd = parseDate(p.date);
      if (isNaN(pd.getTime()) || isNaN(currDate.getTime())) {
        // נפילה חכמה להשוואת מחרוזות במקרה של תאריך לא תקין
        return p.date < date;
      }
      return pd < currDate; // רק תשלומים לפני התשלום הנוכחי
    });
    let balance = 0;
    
    studentPayments.forEach((payment) => {
      const baseExpectedAmount = 
        payment.type === 'חד פעמי' ? (student.isSibling ? 500 : SINGLE_PRICE) :
        student.isSibling ? SIBLING_MONTHLY_PRICE : MONTHLY_PRICE;
      
      // חישוב סכום צפוי אחרי הנחה
      const discount = payment.discount || 0;
      const expectedAmount = baseExpectedAmount * (1 - discount / 100);
      
      // יתרה = סכום ששולם - סכום צפוי
      // אם חיובי = זכות, אם שלילי = חוב
      balance += payment.amount - expectedAmount;
    });
    
    // חישוב סכום התשלום הנוכחי
    let baseAmount = 0;
    let note = '';
    
    if (type === 'חד פעמי') {
      baseAmount = student.isSibling ? 500 : SINGLE_PRICE;
    } else if (type === 'חודשי') {
      // קיזוז תשלומי חד-פעמי באותו חודש של התשלום הנוכחי
      const singles = payments.filter((p) => {
        if (p.studentId !== studentId) return false;
        if (p.type !== 'חד פעמי') return false;
        const pd = parseDate(p.date);
        if (isNaN(pd.getTime()) || isNaN(currDate.getTime())) {
          return p.date.slice(0, 7) === date.slice(0, 7);
        }
        return pd.getFullYear() === currDate.getFullYear() && pd.getMonth() === currDate.getMonth();
      });
      const sumSingles = singles.reduce((sum, p) => sum + p.amount, 0);
      const base = student.isSibling ? SIBLING_MONTHLY_PRICE : MONTHLY_PRICE;
      baseAmount = Math.max(base - sumSingles, 0);
      if (sumSingles > 0) {
        note = `כולל קיזוז ${formatILS(sumSingles)} מתשלומים בחודש`;
      }
    }
    
    // קיזוז יתרה
    const finalAmount = Math.max(baseAmount - balance, 0);

    if (balance > 0) {
      note = note ? `${note} | זכות: ${formatILS(balance)}` : `זכות: ${formatILS(balance)}`;
    } else if (balance < 0) {
      note = note ? `${note} | חוב: ${formatILS(Math.abs(balance))}` : `חוב: ${formatILS(Math.abs(balance))}`;
    }

    // Debug: עוזר לאתר חישוב שגוי
    try {
      const dbgPrev = payments
        .filter((p) => p.studentId === studentId)
        .map((p) => ({ date: p.date, type: p.type, amount: p.amount }));
      console.log('[calcPayment]', { studentId, type, date, balance, baseAmount, finalAmount, prevPayments: dbgPrev });
    } catch {}
    
    return { amount: finalAmount, note };
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background" dir="rtl">
      <header className="bg-card/80 backdrop-blur-md border-b border-border shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4 animate-fade-in">
            <img src={logo} alt="לוגו" className="h-8 sm:h-12 object-contain drop-shadow-lg" />
            <h1 className="text-base sm:text-2xl font-bold bg-gradient-to-l from-primary to-magenta bg-clip-text text-transparent">
              מערכת ניהול מרכז אומנויות הבמה
            </h1>
          </div>
          <Button 
            onClick={signOut}
            size="sm"
            className="bg-gradient-to-l from-magenta to-magenta-hover text-white font-bold text-xs sm:text-lg px-3 sm:px-8 button-hover shadow-lg hover:shadow-xl"
          >
            התנתק
          </Button>
        </div>
      </header>
      <TabNavigation activeTab={tab} onTabChange={setTab} />
      <main className="container mx-auto px-2 sm:px-4">
        <PendingPayments />
        {tab === 'dashboard' && <Dashboard students={students} payments={payments} onAddStudent={() => { studentFormRef.current = { id: '', name: '', lastName: '', phone: '', birthDate: '', parentName: '', parentPhone: '', isSibling: false, siblingId: undefined, className: CLASS_OPTIONS[0], status: 'חדש' }; setEditingStudent(studentFormRef.current); setShowStudentModal(true); }} />}
        {tab === 'students' && <Students 
          students={students}
          payments={payments.map(p => ({ studentId: p.studentId, amount: p.amount, type: p.type, discount: p.discount || 0, date: p.date }))}
          onAddStudent={() => {
            studentFormRef.current = { id: '', name: '', lastName: '', phone: '', birthDate: '', parentName: '', parentPhone: '', isSibling: false, siblingId: undefined, className: CLASS_OPTIONS[0], status: 'חדש' }; 
            setEditingStudent(studentFormRef.current); 
            setShowStudentModal(true); 
          }} 
          onEditStudent={(s) => { 
            studentFormRef.current = { ...s }; 
            setEditingStudent(studentFormRef.current); 
            setShowStudentModal(true); 
          }}
          onDeleteStudent={async (studentId) => {
            if (!user) return;
            if (!confirm('האם אתה בטוח שברצונך למחוק תלמיד זה?')) return;
            
            const { error } = await supabase.from('students').delete().eq('id', studentId).eq('user_id', user.id);
            
            if (error) {
              toast.error('שגיאה במחיקת תלמיד');
              return;
            }
            
            setStudents(prev => prev.filter(s => s.id !== studentId));
            toast.success('תלמיד נמחק!');
          }}
        />}
        {tab === 'payments' && <Payments 
          payments={payments} 
          students={students}
          sessions={sessions}
          onAddPayment={() => {
            setEditingPayment(null);
            setPaymentForm({ studentId: '', type: '', method: 'מזומן', date: new Date().toISOString().slice(0, 10), amount: 0, note: '', discount: 0 }); 
            setShowPaymentModal(true); 
          }}
          onEditPayment={(payment) => {
            setEditingPayment(payment);
            setPaymentForm({
              studentId: payment.studentId,
              type: payment.type,
              method: payment.method,
              date: payment.date,
              amount: payment.amount,
              note: payment.note,
              discount: payment.discount || 0
            });
            setShowPaymentModal(true);
          }}
          onDeletePayment={async (paymentId) => {
            if (!user) return;
            if (!confirm('האם אתה בטוח שברצונך למחוק תשלום זה?')) return;
            
            const { error } = await supabase.from('payments').delete().eq('id', paymentId).eq('user_id', user.id);
            
            if (error) {
              toast.error('שגיאה במחיקת תשלום');
              return;
            }
            
            setPayments(prev => prev.filter(p => p.id !== paymentId));
            toast.success('תשלום נמחק!');
          }}
        />}
        {tab === 'attendance' && <Attendance 
          sessions={sessions} 
          students={students}
          payments={payments}
          onCreateSession={() => setShowSessionForm(true)}
          onEditSession={(session) => {
            setCurrentSession(session);
            setShowSessionForm(true);
          }}
          onDeleteSession={async (sessionId) => {
            if (!user) return;
            if (!confirm('האם אתה בטוח שברצונך למחוק שיעור זה?')) return;
            
            // מחיקת נוכחות
            await supabase.from('attendance').delete().eq('session_id', sessionId).eq('user_id', user.id);
            
            // מחיקת שיעור
            const { error } = await supabase.from('sessions').delete().eq('id', sessionId).eq('user_id', user.id);
            
            if (error) {
              toast.error('שגיאה במחיקת שיעור');
              return;
            }
            
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            toast.success('שיעור נמחק!');
          }}
          onUpdateAttendance={async (sessionId, studentId, status) => {
            if (!user) return;
            
            const session = sessions.find(s => s.id === sessionId);
            if (!session) return;
            
            // עדכון נוכחות
            const { error } = await supabase
              .from('attendance')
              .update({ status })
              .eq('session_id', sessionId)
              .eq('student_id', studentId)
              .eq('user_id', user.id);
            
            if (error) {
              toast.error('שגיאה בעדכון נוכחות');
              return;
            }
            
            // Subscription logic removed - monthly is flat price

            
            // עדכון סטטוס התלמיד בהתאם לסטטוס הנוכחות
            if (status === 'לא באי' || status === 'עזב') {
              const newStatus = status === 'לא באי' ? 'בהקפאה' : 'לא פעיל';
              
              const { error: studentError } = await supabase
                .from('students')
                .update({ status: newStatus })
                .eq('id', studentId)
                .eq('user_id', user.id);
              
              if (!studentError) {
                setStudents((prev) => prev.map(s => 
                  s.id === studentId ? { ...s, status: newStatus } : s
                ));
              }
            }
            
            setSessions(prev => prev.map(s => 
              s.id === sessionId 
                ? { ...s, students: s.students.map(st => st.studentId === studentId ? { ...st, status } : st) }
                : s
            ));
            toast.success('נוכחות עודכנה!');
          }}
          onRemoveStudentFromSession={async (sessionId, studentId) => {
            if (!user) return;
            if (!confirm('האם אתה בטוח שברצונך להסיר תלמיד זה מהשיעור?')) return;
            
            const { error } = await supabase
              .from('attendance')
              .delete()
              .eq('session_id', sessionId)
              .eq('student_id', studentId)
              .eq('user_id', user.id);
            
            if (error) {
              toast.error('שגיאה בהסרת תלמיד');
              return;
            }
            
            setSessions(prev => prev.map(s => 
              s.id === sessionId 
                ? { ...s, students: s.students.filter(st => st.studentId !== studentId) }
                : s
            ));
            toast.success('תלמיד הוסר מהשיעור!');
          }}
        />}
        {tab === 'settings' && <AdminSettings />}
      </main>

      <Dialog open={showStudentModal} onOpenChange={(open) => { if (!open) { setShowStudentModal(false); setEditingStudent(null); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingStudent?.id ? 'עריכת תלמיד' : 'הוספת תלמיד'}</DialogTitle></DialogHeader>
          {editingStudent && <div className="space-y-4">
            <div className="space-y-2"><Label>שם פרטי</Label><Input value={editingStudent.name} onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>שם משפחה</Label><Input value={editingStudent.lastName} onChange={(e) => setEditingStudent({ ...editingStudent, lastName: e.target.value })} /></div>
            <div className="space-y-2"><Label>טלפון תלמיד</Label><Input value={editingStudent.phone} onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>תאריך לידה</Label><Input type="date" value={editingStudent.birthDate} onChange={(e) => setEditingStudent({ ...editingStudent, birthDate: e.target.value })} /></div>
            <div className="space-y-2"><Label>שם הורה</Label><Input value={editingStudent.parentName} onChange={(e) => setEditingStudent({ ...editingStudent, parentName: e.target.value })} /></div>
            <div className="space-y-2"><Label>טלפון הורה</Label><Input value={editingStudent.parentPhone} onChange={(e) => setEditingStudent({ ...editingStudent, parentPhone: e.target.value })} /></div>
            <div className="space-y-2"><Label>אחים בחוג?</Label><Select value={editingStudent.isSibling ? 'true' : 'false'} onValueChange={(v) => setEditingStudent({ ...editingStudent, isSibling: v === 'true', siblingId: v === 'true' ? editingStudent.siblingId : undefined })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="false">לא</SelectItem><SelectItem value="true">כן</SelectItem></SelectContent></Select></div>
            {editingStudent.isSibling && (
              <div className="space-y-2">
                <Label>בחר אח/אחות</Label>
                <Select 
                  value={editingStudent.siblingId || ''} 
                  onValueChange={(v) => {
                    const sibling = students.find(s => s.id === v);
                    if (sibling) {
                      setEditingStudent({ 
                        ...editingStudent, 
                        siblingId: v,
                        parentName: sibling.parentName,
                        lastName: sibling.lastName,
                        parentPhone: sibling.parentPhone
                      });
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="בחר תלמיד" /></SelectTrigger>
                  <SelectContent>
                    {students
                      .filter(s => s.id !== editingStudent.id)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} {s.lastName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2"><Label>שיוך חוג</Label><Select value={editingStudent.className} onValueChange={(v) => setEditingStudent({ ...editingStudent, className: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CLASS_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>סטטוס</Label><Select value={editingStudent.status} onValueChange={(v: Student['status']) => setEditingStudent({ ...editingStudent, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="חדש">חדש</SelectItem><SelectItem value="פעיל">פעיל</SelectItem><SelectItem value="בהקפאה">בהקפאה</SelectItem><SelectItem value="לא פעיל">לא פעיל</SelectItem></SelectContent></Select></div>
            <div className="space-y-2">
              <Label>קישור לחשבון תלמיד (אימייל)</Label>
              <Input 
                type="email" 
                placeholder="אימייל התלמיד/הורה שנרשם למערכת" 
                value={editingStudent.linkedEmail || ''} 
                onChange={(e) => setEditingStudent({ ...editingStudent, linkedEmail: e.target.value })} 
              />
              <p className="text-xs text-muted-foreground">הזן את האימייל שבו התלמיד/הורה נרשם לאזור האישי</p>
            </div>
            <div className="flex gap-3">
              <Button 
                className="flex-1" 
                onClick={async () => { 
                  if (!editingStudent.name || !user) { 
                    toast.error('נא למלא שם'); 
                    return; 
                  } 
                  let savedStudentId: string;
                  if (!editingStudent.id) { 
                  const { data, error } = await supabase
                    .from('students')
                    .insert({
                      user_id: user.id,
                      name: editingStudent.name,
                      last_name: editingStudent.lastName,
                      phone: editingStudent.phone || null,
                      birth_date: editingStudent.birthDate || null,
                      parent_name: editingStudent.parentName || null,
                      parent_phone: editingStudent.parentPhone || null,
                      is_sibling: editingStudent.isSibling,
                      sibling_id: editingStudent.siblingId || null,
                      class_name: editingStudent.className,
                      status: editingStudent.status
                    })
                    .select()
                    .single();
                    
                    if (error) {
                      toast.error('שגיאה בשמירת תלמיד');
                      return;
                    }
                    
                    savedStudentId = data.id;
                    const newStudent = { 
                      ...editingStudent, 
                      id: data.id
                    };
                    setStudents((prev) => [...prev, newStudent].sort((a, b) => a.name.localeCompare(b.name, 'he'))); 
                    toast.success('תלמיד נוסף!');
                  } else { 
                    const oldStudent = students.find(s => s.id === editingStudent.id);
                    const isBecomingActive = oldStudent && oldStudent.status !== 'פעיל' && editingStudent.status === 'פעיל';
                    
                    const { error } = await supabase
                      .from('students')
                      .update({
                        name: editingStudent.name,
                        last_name: editingStudent.lastName,
                        phone: editingStudent.phone || null,
                        birth_date: editingStudent.birthDate || null,
                        parent_name: editingStudent.parentName || null,
                        parent_phone: editingStudent.parentPhone || null,
                        is_sibling: editingStudent.isSibling,
                        sibling_id: editingStudent.siblingId || null,
                        class_name: editingStudent.className,
                        status: editingStudent.status
                      })
                      .eq('id', editingStudent.id)
                      .eq('user_id', user.id);
                    
                    if (error) {
                      toast.error('שגיאה בעדכון תלמיד');
                      return;
                    }
                    
                    // אם התלמיד הפך לפעיל, הוסף אותו לשיעורים עתידיים
                    if (isBecomingActive) {
                      const today = new Date().toISOString().slice(0, 10);
                      const futureSessions = sessions.filter(s => 
                        s.className === editingStudent.className && 
                        s.date >= today
                      );
                      
                      for (const session of futureSessions) {
                        const isInSession = session.students.some(st => st.studentId === editingStudent.id);
                        if (!isInSession) {
                          await supabase
                            .from('attendance')
                            .insert({
                              user_id: user.id,
                              session_id: session.id,
                              student_id: editingStudent.id,
                              status: 'נוכח'
                            });
                        }
                      }
                      
                      // עדכון המצב המקומי
                      setSessions(prev => prev.map(s => {
                        if (s.className === editingStudent.className && s.date >= today) {
                          const isInSession = s.students.some(st => st.studentId === editingStudent.id);
                          if (!isInSession) {
                            return {
                              ...s,
                              students: [...s.students, { studentId: editingStudent.id, status: 'נוכח' }]
                            };
                          }
                        }
                        return s;
                      }));
                    }
                    
                    savedStudentId = editingStudent.id;
                    setStudents((prev) => prev.map((s) => s.id === editingStudent.id ? editingStudent : s).sort((a, b) => a.name.localeCompare(b.name, 'he'))); 
                    toast.success('תלמיד עודכן!');
                  }
                  
                  // Link student to auth user if email provided
                  if (editingStudent.linkedEmail) {
                    const { data: linkResult, error: linkError } = await supabase.functions.invoke('link-student', {
                      body: { email: editingStudent.linkedEmail, studentId: savedStudentId }
                    });
                    if (linkError || linkResult?.error) {
                      toast.error(linkResult?.message || 'שגיאה בקישור חשבון');
                    } else {
                      toast.success('חשבון קושר בהצלחה!');
                    }
                  }
                  
                  setShowStudentModal(false); 
                  setEditingStudent(null);
                  // מעבר לעמוד תשלומים והוספת תשלום
                  setTab('payments');
                  setPaymentForm({ 
                    studentId: savedStudentId, 
                    type: '', 
                    method: 'מזומן', 
                    date: new Date().toISOString().slice(0, 10),
                    amount: 0,
                    note: '',
                    discount: 0
                  });
                  setShowPaymentModal(true);
                }}
              >
                אישור ומעבר לתשלום
              </Button>
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={async () => { 
                  if (!editingStudent.name || !user) { 
                    toast.error('נא למלא שם'); 
                    return; 
                  }
                  if (!editingStudent.id) { 
                    const { data, error } = await supabase
                      .from('students')
                      .insert({
                        user_id: user.id,
                        name: editingStudent.name,
                        last_name: editingStudent.lastName,
                        phone: editingStudent.phone || null,
                        birth_date: editingStudent.birthDate || null,
                        parent_name: editingStudent.parentName || null,
                        parent_phone: editingStudent.parentPhone || null,
                        is_sibling: editingStudent.isSibling,
                        sibling_id: editingStudent.siblingId || null,
                        class_name: editingStudent.className,
                        status: editingStudent.status
                      })
                      .select()
                      .single();
                    
                    if (error) {
                      toast.error('שגיאה בשמירת תלמיד');
                      return;
                    }
                    
                    const newStudent = { 
                      ...editingStudent, 
                      id: data.id
                    };
                    setStudents((prev) => [...prev, newStudent]); 
                    toast.success('תלמיד נוסף!');
                  } else { 
                    const oldStudent = students.find(s => s.id === editingStudent.id);
                    const isBecomingActive = oldStudent && oldStudent.status !== 'פעיל' && editingStudent.status === 'פעיל';
                    
                    const { error } = await supabase
                      .from('students')
                      .update({
                        name: editingStudent.name,
                        last_name: editingStudent.lastName,
                        phone: editingStudent.phone || null,
                        birth_date: editingStudent.birthDate || null,
                        parent_name: editingStudent.parentName || null,
                        parent_phone: editingStudent.parentPhone || null,
                        is_sibling: editingStudent.isSibling,
                        sibling_id: editingStudent.siblingId || null,
                        class_name: editingStudent.className,
                        status: editingStudent.status
                      })
                      .eq('id', editingStudent.id)
                      .eq('user_id', user.id);
                    
                    if (error) {
                      toast.error('שגיאה בעדכון תלמיד');
                      return;
                    }
                    
                    // אם התלמיד הפך לפעיל, הוסף אותו לשיעורים עתידיים
                    if (isBecomingActive) {
                      const today = new Date().toISOString().slice(0, 10);
                      const futureSessions = sessions.filter(s => 
                        s.className === editingStudent.className && 
                        s.date >= today
                      );
                      
                      for (const session of futureSessions) {
                        const isInSession = session.students.some(st => st.studentId === editingStudent.id);
                        if (!isInSession) {
                          await supabase
                            .from('attendance')
                            .insert({
                              user_id: user.id,
                              session_id: session.id,
                              student_id: editingStudent.id,
                              status: 'נוכח'
                            });
                        }
                      }
                      
                      // עדכון המצב המקומי
                      setSessions(prev => prev.map(s => {
                        if (s.className === editingStudent.className && s.date >= today) {
                          const isInSession = s.students.some(st => st.studentId === editingStudent.id);
                          if (!isInSession) {
                            return {
                              ...s,
                              students: [...s.students, { studentId: editingStudent.id, status: 'נוכח' }]
                            };
                          }
                        }
                        return s;
                      }));
                    }
                    
                    setStudents((prev) => prev.map((s) => s.id === editingStudent.id ? editingStudent : s)); 
                    toast.success('תלמיד עודכן!'); 
                  }
                  
                  // Link student to auth user if email provided
                  const studentIdToLink = editingStudent.id || '';
                  if (editingStudent.linkedEmail && studentIdToLink) {
                    const { data: linkResult, error: linkError } = await supabase.functions.invoke('link-student', {
                      body: { email: editingStudent.linkedEmail, studentId: studentIdToLink }
                    });
                    if (linkError || linkResult?.error) {
                      toast.error(linkResult?.message || 'שגיאה בקישור חשבון');
                    } else {
                      toast.success('חשבון קושר בהצלחה!');
                    }
                  }
                  
                  setShowStudentModal(false); 
                  setEditingStudent(null); 
                }}
              >
                אישור
              </Button>
              <Button 
                variant="secondary" 
                className="flex-1" 
                onClick={() => { 
                  setShowStudentModal(false); 
                  setEditingStudent(null); 
                }}
              >
                ביטול
              </Button>
            </div>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentModal} onOpenChange={(open) => { if (!open) { setShowPaymentModal(false); setEditingPayment(null); setStudentSearchValue(''); } }}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>{editingPayment ? 'עריכת תשלום' : 'הוספת תשלום'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>תלמיד</Label>
              <Popover open={openStudentCombobox} onOpenChange={setOpenStudentCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openStudentCombobox}
                    className="w-full justify-between"
                  >
                    {paymentForm.studentId
                      ? (() => {
                          const student = students.find((s) => s.id === paymentForm.studentId);
                          return student ? `${student.name}${student.lastName ? ' ' + student.lastName : ''}` : 'בחר תלמיד';
                        })()
                      : 'בחר תלמיד'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="חפש תלמיד..." 
                      value={studentSearchValue}
                      onValueChange={setStudentSearchValue}
                    />
                    <CommandList>
                      <CommandEmpty>לא נמצאו תלמידים</CommandEmpty>
                      <CommandGroup>
                        {students.map((student) => (
                            <CommandItem
                              key={student.id}
                              value={`${student.name}${student.lastName ? ' ' + student.lastName : ''}`}
                              onSelect={() => {
                                setPaymentForm({ ...paymentForm, studentId: student.id });
                                if (paymentForm.type) {
                                  const calc = calcPayment(student.id, paymentForm.type, paymentForm.date);
                                  setPaymentForm(prev => ({ ...prev, studentId: student.id, amount: calc.amount, note: calc.note }));
                                }
                                setOpenStudentCombobox(false);
                                setStudentSearchValue('');
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  paymentForm.studentId === student.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {student.name}{student.lastName ? ` ${student.lastName}` : ''}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2"><Label>סוג תשלום</Label><Select value={paymentForm.type} onValueChange={(v) => {
              setPaymentForm({ ...paymentForm, type: v }); 
              if (paymentForm.studentId) {
                const calc = calcPayment(paymentForm.studentId, v, paymentForm.date);
                setPaymentForm(prev => ({ ...prev, type: v, amount: calc.amount, note: calc.note }));
              }
            }}><SelectTrigger><SelectValue placeholder="בחר סוג" /></SelectTrigger><SelectContent>
              {(() => {
                const selectedStudent = students.find(s => s.id === paymentForm.studentId);
                const isSib = selectedStudent?.isSibling;
                return <>
                  <SelectItem value="חד פעמי">חד פעמי (฿{isSib ? '500' : '700'})</SelectItem>
                  <SelectItem value="חודשי">חודשי (฿{isSib ? '3,200' : '4,000'})</SelectItem>
                </>;
              })()}
            </SelectContent></Select></div>
            {paymentForm.studentId && (() => {
              const selectedStudent = students.find(s => s.id === paymentForm.studentId);
              return selectedStudent?.isSibling ? (
                <div className="text-xs text-primary font-medium bg-primary/10 rounded-lg px-3 py-1.5">👫 תלמיד אח/אחות — מחיר מוזל</div>
              ) : null;
            })()}
            <div className="space-y-2"><Label>אמצעי תשלום</Label><Select value={paymentForm.method} onValueChange={(v: 'מזומן' | 'סקאן') => setPaymentForm({ ...paymentForm, method: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="מזומן">מזומן</SelectItem><SelectItem value="סקאן">סקאן</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>תאריך</Label><Input type="date" value={paymentForm.date} onChange={(e) => { 
              setPaymentForm({ ...paymentForm, date: e.target.value }); 
              if (paymentForm.studentId && paymentForm.type) {
                const calc = calcPayment(paymentForm.studentId, paymentForm.type, e.target.value);
                setPaymentForm(prev => ({ ...prev, date: e.target.value, amount: calc.amount, note: calc.note }));
              }
            }} /></div>
            <div className="space-y-2"><Label>הנחה (%)</Label><Input type="number" min="0" max="100" value={paymentForm.discount} onChange={(e) => { 
              const newDiscount = Number(e.target.value);
              setPaymentForm(prev => ({ ...prev, discount: newDiscount }));
              
              if (paymentForm.studentId && paymentForm.type) {
                const calc = calcPayment(paymentForm.studentId, paymentForm.type, paymentForm.date);
                const amountWithDiscount = calc.amount * (1 - newDiscount / 100);
                setPaymentForm(prev => ({ ...prev, discount: newDiscount, amount: Math.round(amountWithDiscount) }));
              }
            }} /></div>
            <div className="space-y-2">
              <Label>סכום שהתקבל</Label>
              <Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })} />
              <p className="text-xs text-muted-foreground">אם התלמיד שילם יותר מהמחיר, הזן את הסכום שקיבלת. הזכות תירשם אוטומטית.</p>
            </div>
            {paymentForm.amount > 0 && paymentForm.type && paymentForm.studentId && (() => {
              const selectedStudent = students.find(s => s.id === paymentForm.studentId);
              if (!selectedStudent) return null;
              const basePrice = paymentForm.type === 'חד פעמי'
                ? (selectedStudent.isSibling ? 500 : 700)
                : (selectedStudent.isSibling ? 3200 : 4000);
              const discountedPrice = basePrice * (1 - (paymentForm.discount || 0) / 100);
              const diff = paymentForm.amount - discountedPrice;
              if (diff > 0) {
                return <div className="text-sm font-medium text-green-700 bg-green-50 rounded-lg px-3 py-2">💰 זכות של ฿{diff} תירשם לתלמיד</div>;
              } else if (diff < 0) {
                return <div className="text-sm font-medium text-red-700 bg-red-50 rounded-lg px-3 py-2">⚠️ חוב של ฿{Math.abs(diff)} יירשם לתלמיד</div>;
              }
              return null;
            })()}
            {paymentForm.note && <div className="text-sm text-muted-foreground">{paymentForm.note}</div>}
            <div className="flex gap-3"><Button className="flex-1" onClick={async () => { 
              if (!paymentForm.studentId || !paymentForm.type || !user) { 
                toast.error('נא למלא את כל השדות'); 
                return; 
              } 
              
              if (editingPayment) {
                // עדכון תשלום קיים
                const { error } = await supabase
                  .from('payments')
                  .update({
                    payment_type: paymentForm.type,
                    payment_method: paymentForm.method,
                    payment_date: paymentForm.date,
                    amount: paymentForm.amount,
                    note: paymentForm.note,
                    discount: paymentForm.discount
                  })
                  .eq('id', editingPayment.id)
                  .eq('user_id', user.id);
                
                if (error) {
                  toast.error('שגיאה בעדכון תשלום');
                  return;
                }
                
                setPayments((prev) => prev.map(p => 
                  p.id === editingPayment.id 
                    ? { ...p, type: paymentForm.type as Payment['type'], method: paymentForm.method, date: paymentForm.date, amount: paymentForm.amount, note: paymentForm.note, discount: paymentForm.discount }
                    : p
                ));
                
                toast.success('תשלום עודכן!');
              } else {
                // הוספת תשלום חדש
                const { data, error } = await supabase
                  .from('payments')
                  .insert({
                    user_id: user.id,
                    student_id: paymentForm.studentId,
                    payment_type: paymentForm.type,
                    payment_method: paymentForm.method,
                    payment_date: paymentForm.date,
                    amount: paymentForm.amount,
                    note: paymentForm.note,
                    discount: paymentForm.discount
                  })
                  .select()
                  .single();
                
                if (error) {
                  toast.error('שגיאה בשמירת תשלום');
                  return;
                }
                
                const newPayment = { 
                  id: data.id, 
                  studentId: paymentForm.studentId, 
                  type: paymentForm.type as Payment['type'], 
                  method: paymentForm.method, 
                  date: paymentForm.date, 
                  amount: paymentForm.amount, 
                  note: paymentForm.note,
                  discount: paymentForm.discount
                };
                
                setPayments((prev) => [...prev, newPayment]);
                
                // בדיקה אם זה התשלום השני והפיכת התלמיד לפעיל
                const studentPayments = payments.filter(p => p.studentId === paymentForm.studentId);
                if (studentPayments.length >= 1) { // התשלום הנוכחי + תשלום אחד קיים = 2 תשלומים
                  const student = students.find(s => s.id === paymentForm.studentId);
                  if (student && student.status !== 'פעיל') {
                    const { error: updateError } = await supabase
                      .from('students')
                      .update({ status: 'פעיל' })
                      .eq('id', paymentForm.studentId)
                      .eq('user_id', user.id);
                    
                    if (!updateError) {
                      setStudents((prev) => prev.map(s => 
                        s.id === paymentForm.studentId ? { ...s, status: 'פעיל' } : s
                      ));
                    }
                  }
                }
                
                toast.success('תשלום נוסף!');
              }
              
              setShowPaymentModal(false); 
              setEditingPayment(null);
              setPaymentForm({ studentId: '', type: '', method: 'מזומן', date: new Date().toISOString().slice(0, 10), amount: 0, note: '', discount: 0 }); 
            }}>אישור</Button><Button variant="outline" className="flex-1" onClick={() => { setShowPaymentModal(false); setEditingPayment(null); }}>ביטול</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSessionForm} onOpenChange={(open) => { if (!open) { setShowSessionForm(false); setCurrentSession(null); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{currentSession?.id ? `עריכת נוכחות ${currentSession.date}` : currentSession ? `נוכחות ${currentSession.date}` : 'יצירת שיעור'}</DialogTitle></DialogHeader>
          {!currentSession ? <div className="space-y-4">
            <div className="space-y-2"><Label>חוג</Label><Select value={sessionForm.className} onValueChange={(v) => setSessionForm({ ...sessionForm, className: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CLASS_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>תאריך</Label><Input type="date" value={sessionForm.date} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })} /></div>
            <div className="flex gap-3"><Button className="flex-1" onClick={() => setCurrentSession({ id: '', className: sessionForm.className, date: sessionForm.date, trial: false, students: students.filter((s) => s.className === sessionForm.className).map((s) => ({ studentId: s.id, status: '' })) })}>המשך</Button><Button variant="outline" className="flex-1" onClick={() => setShowSessionForm(false)}>ביטול</Button></div>
          </div> : <div className="space-y-4">
            {currentSession.students.map((rec, idx) => {
              const student = students.find((s) => s.id === rec.studentId);
              if (!student) return null;
              
              const paymentStatus = getPaymentStatusForSession(student, currentSession, payments, []);
              const statusColor = getStatusColor(paymentStatus);
              const statusBadge = getStatusBadge(paymentStatus);
              
              return (
                <div key={rec.studentId} className={cn("flex gap-2 items-center p-2 rounded", statusColor)}>
                  <span className="flex-1 font-medium">{student.name} {student.lastName}</span>
                  {statusBadge && <Badge variant="outline" className="text-xs">{statusBadge}</Badge>}
                  <Select value={rec.status || undefined} onValueChange={(v) => {
                    if (v && v !== '') {
                      const newStudents = [...currentSession.students]; 
                      newStudents[idx] = { ...rec, status: v as 'נוכח' | 'לא הגיע' | 'לא באי' | 'עזב' }; 
                      setCurrentSession({ ...currentSession, students: newStudents }); 
                    }
                  }}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="בחר" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="נוכח">נוכח</SelectItem>
                      <SelectItem value="לא הגיע">לא הגיע</SelectItem>
                      <SelectItem value="לא באי">לא באי (הקפאה)</SelectItem>
                      <SelectItem value="עזב">עזב</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
            <div className="flex gap-3"><Button className="flex-1" onClick={async () => { 
              if (!user) return;
              
              if (currentSession.id) {
                // עדכון שיעור קיים
                const { error: sessionError } = await supabase
                  .from('sessions')
                  .update({
                    class_name: currentSession.className,
                    session_date: currentSession.date,
                    is_trial: currentSession.trial
                  })
                  .eq('id', currentSession.id)
                  .eq('user_id', user.id);
                
                if (sessionError) {
                  toast.error('שגיאה בעדכון שיעור');
                  return;
                }
                
                // עדכון נוכחות
                for (const { studentId, status } of currentSession.students) {
                  await supabase
                    .from('attendance')
                    .update({ status })
                    .eq('session_id', currentSession.id)
                    .eq('student_id', studentId)
                    .eq('user_id', user.id);
                }
                
                setSessions((prev) => prev.map(s => s.id === currentSession.id ? currentSession : s));
                toast.success('שיעור עודכן!');
              } else {
                // שמירת שיעור חדש
                const { data: sessionData, error: sessionError } = await supabase
                  .from('sessions')
                  .insert({
                    user_id: user.id,
                    class_name: currentSession.className,
                    session_date: currentSession.date,
                    is_trial: currentSession.trial
                  })
                  .select()
                  .single();
                
                if (sessionError) {
                  toast.error('שגיאה בשמירת שיעור');
                  return;
                }
                
                // שמירת נוכחות
                for (const { studentId, status } of currentSession.students) {
                  await supabase
                    .from('attendance')
                    .insert({
                      user_id: user.id,
                      session_id: sessionData.id,
                      student_id: studentId,
                      status: status
                    });
                  
                }
                
                setSessions((prev) => [...prev, { ...currentSession, id: sessionData.id }]);
                toast.success('שיעור נשמר!');
              }
              
              setCurrentSession(null); 
              setShowSessionForm(false); 
              setSessionForm({ className: CLASS_OPTIONS[0], date: new Date().toISOString().slice(0, 10), trial: false }); 
            }}>אישור</Button><Button variant="outline" className="flex-1" onClick={() => { setCurrentSession(null); setShowSessionForm(false); }}>ביטול</Button></div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
