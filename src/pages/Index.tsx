import { useState, useEffect, useRef } from 'react';
import { Student, Payment, Session, CLASS_OPTIONS, MONTHLY_PRICE, SIBLING_MONTHLY_PRICE, SINGLE_PRICE, TRIAL_PRICE } from '@/types';
import TabNavigation from '@/components/TabNavigation';
import Dashboard from '@/components/Dashboard';
import Students from '@/components/Students';
import Payments from '@/components/Payments';
import Attendance from '@/components/Attendance';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  const { user } = useAuth();
  const [tab, setTab] = useState('dashboard');
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const studentFormRef = useRef<Student | null>(null);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState<{ studentId: string; type: string; method: 'מזומן' | 'סקאן'; date: string; amount: number; note: string }>({ studentId: '', type: '', method: 'מזומן', date: new Date().toISOString().slice(0, 10), amount: 0, note: '' });
  
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
      
      if (studentsData) {
        setStudents(studentsData.map(s => ({
          id: parseInt(s.id),
          name: s.name,
          lastName: s.last_name || '',
          phone: s.phone || '',
          birthDate: s.birth_date || '',
          parentName: s.parent_name || '',
          parentPhone: s.parent_phone || '',
          isSibling: s.is_sibling || false,
          className: s.class_name,
          status: s.status as Student['status']
        })));
      }
      
      if (paymentsData) {
        setPayments(paymentsData.map(p => ({
          id: parseInt(p.id),
          studentId: parseInt(p.student_id),
          type: p.payment_type as Payment['type'],
          method: p.payment_method as Payment['method'],
          date: p.payment_date,
          amount: Number(p.amount),
          note: p.note || ''
        })));
      }
      
      if (sessionsData) {
        setSessions(sessionsData.map(s => ({
          id: parseInt(s.id),
          className: s.class_name,
          date: s.session_date,
          trial: s.is_trial || false,
          students: []
        })));
      }
    };
    
    loadData();
  }, [user]);

  function calcPayment(studentId: number, type: string, date: string) {
    const student = students.find((s) => s.id === studentId);
    if (!student) return { amount: 0, note: '' };
    if (type === 'ניסיון') return { amount: TRIAL_PRICE, note: '' };
    if (type === 'חד פעמי') return { amount: SINGLE_PRICE, note: '' };
    if (type === 'חודשי') {
      const monthKey = date.slice(0, 7);
      const singles = payments.filter((p) => p.studentId === studentId && p.date.slice(0, 7) === monthKey && (p.type === 'ניסיון' || p.type === 'חד פעמי'));
      const sumSingles = singles.reduce((sum, p) => sum + p.amount, 0);
      const base = student.isSibling ? SIBLING_MONTHLY_PRICE : MONTHLY_PRICE;
      const final = Math.max(base - sumSingles, 0);
      return { amount: final, note: sumSingles > 0 ? `כולל קיזוז ${sumSingles} ₪` : '' };
    }
    return { amount: 0, note: '' };
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <TabNavigation activeTab={tab} onTabChange={setTab} />
      <main>
        {tab === 'dashboard' && <Dashboard students={students} payments={payments} />}
        {tab === 'students' && <Students students={students} onAddStudent={() => { studentFormRef.current = { id: 0, name: '', lastName: '', phone: '', birthDate: '', parentName: '', parentPhone: '', isSibling: false, className: CLASS_OPTIONS[0], status: 'חדש' }; setEditingStudent(studentFormRef.current); setShowStudentModal(true); }} onEditStudent={(s) => { studentFormRef.current = { ...s }; setEditingStudent(studentFormRef.current); setShowStudentModal(true); }} />}
        {tab === 'payments' && <Payments payments={payments} students={students} onAddPayment={() => setShowPaymentModal(true)} />}
        {tab === 'attendance' && <Attendance sessions={sessions} students={students} onCreateSession={() => setShowSessionForm(true)} />}
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
            <div className="space-y-2"><Label>אחים בחוג?</Label><Select value={editingStudent.isSibling ? 'true' : 'false'} onValueChange={(v) => setEditingStudent({ ...editingStudent, isSibling: v === 'true' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="false">לא</SelectItem><SelectItem value="true">כן</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>שיוך חוג</Label><Select value={editingStudent.className} onValueChange={(v) => setEditingStudent({ ...editingStudent, className: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CLASS_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>סטטוס</Label><Select value={editingStudent.status} onValueChange={(v: Student['status']) => setEditingStudent({ ...editingStudent, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="חדש">חדש</SelectItem><SelectItem value="פעיל">פעיל</SelectItem><SelectItem value="בהקפאה">בהקפאה</SelectItem><SelectItem value="בהמתנה">בהמתנה</SelectItem></SelectContent></Select></div>
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
                      id: parseInt(data.id)
                    };
                    setStudents((prev) => [...prev, newStudent]); 
                    toast.success('תלמיד נוסף!'); 
                  } else { 
                    const { error } = await supabase
                      .from('students')
                      .update({
                        name: editingStudent.name,
                        last_name: editingStudent.lastName,
                        phone: editingStudent.phone,
                        birth_date: editingStudent.birthDate,
                        parent_name: editingStudent.parentName,
                        parent_phone: editingStudent.parentPhone,
                        is_sibling: editingStudent.isSibling,
                        class_name: editingStudent.className,
                        status: editingStudent.status
                      })
                      .eq('id', editingStudent.id.toString())
                      .eq('user_id', user.id);
                    
                    if (error) {
                      toast.error('שגיאה בעדכון תלמיד');
                      return;
                    }
                    
                    savedStudentId = editingStudent.id.toString();
                    setStudents((prev) => prev.map((s) => s.id === editingStudent.id ? editingStudent : s)); 
                    toast.success('תלמיד עודכן!'); 
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
                    note: ''
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
                      id: parseInt(data.id)
                    };
                    setStudents((prev) => [...prev, newStudent]); 
                    toast.success('תלמיד נוסף!'); 
                  } else { 
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
                        class_name: editingStudent.className,
                        status: editingStudent.status
                      })
                      .eq('id', editingStudent.id.toString())
                      .eq('user_id', user.id);
                    
                    if (error) {
                      toast.error('שגיאה בעדכון תלמיד');
                      return;
                    }
                    
                    setStudents((prev) => prev.map((s) => s.id === editingStudent.id ? editingStudent : s)); 
                    toast.success('תלמיד עודכן!'); 
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

      <Dialog open={showPaymentModal} onOpenChange={(open) => { if (!open) setShowPaymentModal(false); }}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>הוספת תשלום</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>תלמיד</Label><Select value={paymentForm.studentId} onValueChange={(v) => { 
              setPaymentForm({ ...paymentForm, studentId: v }); 
              if (v && paymentForm.type) {
                const calc = calcPayment(Number(v), paymentForm.type, paymentForm.date);
                setPaymentForm(prev => ({ ...prev, studentId: v, amount: calc.amount, note: calc.note }));
              }
            }}><SelectTrigger><SelectValue placeholder="בחר תלמיד" /></SelectTrigger><SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>סוג תשלום</Label><Select value={paymentForm.type} onValueChange={(v) => { 
              setPaymentForm({ ...paymentForm, type: v }); 
              if (paymentForm.studentId) {
                const calc = calcPayment(Number(paymentForm.studentId), v, paymentForm.date);
                setPaymentForm(prev => ({ ...prev, type: v, amount: calc.amount, note: calc.note }));
              }
            }}><SelectTrigger><SelectValue placeholder="בחר סוג" /></SelectTrigger><SelectContent><SelectItem value="ניסיון">ניסיון (700 ₪)</SelectItem><SelectItem value="חד פעמי">חד פעמי (800 ₪)</SelectItem><SelectItem value="חודשי">חודשי</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>אמצעי תשלום</Label><Select value={paymentForm.method} onValueChange={(v: 'מזומן' | 'סקאן') => setPaymentForm({ ...paymentForm, method: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="מזומן">מזומן</SelectItem><SelectItem value="סקאן">סקאן</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>תאריך</Label><Input type="date" value={paymentForm.date} onChange={(e) => { 
              setPaymentForm({ ...paymentForm, date: e.target.value }); 
              if (paymentForm.studentId && paymentForm.type) {
                const calc = calcPayment(Number(paymentForm.studentId), paymentForm.type, e.target.value);
                setPaymentForm(prev => ({ ...prev, date: e.target.value, amount: calc.amount, note: calc.note }));
              }
            }} /></div>
            <div className="space-y-2"><Label>סכום (₪)</Label><Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })} /></div>
            {paymentForm.note && <div className="text-sm text-muted-foreground">{paymentForm.note}</div>}
            <div className="flex gap-3"><Button className="flex-1" onClick={async () => { 
              if (!paymentForm.studentId || !paymentForm.type || !user) { 
                toast.error('נא למלא את כל השדות'); 
                return; 
              } 
              
              const { data, error } = await supabase
                .from('payments')
                .insert({
                  user_id: user.id,
                  student_id: paymentForm.studentId,
                  payment_type: paymentForm.type,
                  payment_method: paymentForm.method,
                  payment_date: paymentForm.date,
                  amount: paymentForm.amount,
                  note: paymentForm.note
                })
                .select()
                .single();
              
              if (error) {
                toast.error('שגיאה בשמירת תשלום');
                return;
              }
              
              setPayments((prev) => [...prev, { 
                id: parseInt(data.id), 
                studentId: Number(paymentForm.studentId), 
                type: paymentForm.type as Payment['type'], 
                method: paymentForm.method, 
                date: paymentForm.date, 
                amount: paymentForm.amount, 
                note: paymentForm.note 
              }]); 
              setShowPaymentModal(false); 
              setPaymentForm({ studentId: '', type: '', method: 'מזומן', date: new Date().toISOString().slice(0, 10), amount: 0, note: '' }); 
              toast.success('תשלום נוסף!'); 
            }}>אישור</Button><Button variant="outline" className="flex-1" onClick={() => setShowPaymentModal(false)}>ביטול</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSessionForm} onOpenChange={(open) => { if (!open) { setShowSessionForm(false); setCurrentSession(null); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{currentSession ? `נוכחות ${currentSession.date}` : 'יצירת שיעור'}</DialogTitle></DialogHeader>
          {!currentSession ? <div className="space-y-4">
            <div className="space-y-2"><Label>חוג</Label><Select value={sessionForm.className} onValueChange={(v) => setSessionForm({ ...sessionForm, className: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CLASS_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>תאריך</Label><Input type="date" value={sessionForm.date} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })} /></div>
            <div className="space-y-2"><Label>ניסיון?</Label><Select value={sessionForm.trial ? 'true' : 'false'} onValueChange={(v) => setSessionForm({ ...sessionForm, trial: v === 'true' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="false">לא</SelectItem><SelectItem value="true">כן</SelectItem></SelectContent></Select></div>
            <div className="flex gap-3"><Button className="flex-1" onClick={() => setCurrentSession({ id: 0, className: sessionForm.className, date: sessionForm.date, trial: sessionForm.trial, students: students.filter((s) => s.className === sessionForm.className).map((s) => ({ studentId: s.id, status: 'נוכח' })) })}>המשך</Button><Button variant="outline" className="flex-1" onClick={() => setShowSessionForm(false)}>ביטול</Button></div>
          </div> : <div className="space-y-4">
            {currentSession.students.map((rec, idx) => <div key={rec.studentId} className="flex gap-2 items-center"><span className="flex-1">{students.find((s) => s.id === rec.studentId)?.name}</span><Select value={rec.status} onValueChange={(v: typeof rec.status) => { const newStudents = [...currentSession.students]; newStudents[idx] = { ...rec, status: v }; setCurrentSession({ ...currentSession, students: newStudents }); }}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="נוכח">נוכח</SelectItem><SelectItem value="לא הגיע">לא הגיע</SelectItem><SelectItem value="לא באי">לא באי</SelectItem></SelectContent></Select></div>)}
            <div className="flex gap-3"><Button className="flex-1" onClick={async () => { 
              if (!user) return;
              
              // שמירת השיעור
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
                    student_id: studentId.toString(),
                    status: status
                  });
                
                // אם זה ניסיון והתלמיד נוכח, צור תשלום
                if (currentSession.trial && status === 'נוכח' && !payments.some((p) => p.studentId === studentId && p.type === 'ניסיון' && p.date === currentSession.date)) {
                  const { amount, note } = calcPayment(studentId, 'ניסיון', currentSession.date);
                  await supabase
                    .from('payments')
                    .insert({
                      user_id: user.id,
                      student_id: studentId.toString(),
                      payment_type: 'ניסיון',
                      payment_method: 'מזומן',
                      payment_date: currentSession.date,
                      amount,
                      note
                    });
                  
                  setPayments((prev) => [...prev, { id: Date.now(), studentId, type: 'ניסיון', method: 'מזומן', date: currentSession.date, amount, note }]);
                }
              }
              
              setSessions((prev) => [...prev, { ...currentSession, id: parseInt(sessionData.id) }]); 
              setCurrentSession(null); 
              setShowSessionForm(false); 
              setSessionForm({ className: CLASS_OPTIONS[0], date: new Date().toISOString().slice(0, 10), trial: false }); 
              toast.success('שיעור נשמר!'); 
            }}>אישור</Button><Button variant="outline" className="flex-1" onClick={() => { setCurrentSession(null); setShowSessionForm(false); }}>ביטול</Button></div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
