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

const genId = () => Date.now() + Math.floor(Math.random() * 1000);

export default function Index() {
  const [tab, setTab] = useState('dashboard');
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const studentFormRef = useRef<Student | null>(null);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState<{ studentId: string; type: string; method: 'מזומן' | 'סקאן'; date: string }>({ studentId: '', type: '', method: 'מזומן', date: new Date().toISOString().slice(0, 10) });
  
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionForm, setSessionForm] = useState<{ className: string; date: string; trial: boolean }>({ className: CLASS_OPTIONS[0], date: new Date().toISOString().slice(0, 10), trial: false });
  const [currentSession, setCurrentSession] = useState<Session | null>(null);

  useEffect(() => {
    try {
      setStudents(JSON.parse(localStorage.getItem('omanuyot_students') || '[]'));
      setPayments(JSON.parse(localStorage.getItem('omanuyot_payments') || '[]'));
      setSessions(JSON.parse(localStorage.getItem('omanuyot_sessions') || '[]'));
    } catch (err) {
      console.error('שגיאה:', err);
    }
  }, []);

  useEffect(() => { localStorage.setItem('omanuyot_students', JSON.stringify(students)); }, [students]);
  useEffect(() => { localStorage.setItem('omanuyot_payments', JSON.stringify(payments)); }, [payments]);
  useEffect(() => { localStorage.setItem('omanuyot_sessions', JSON.stringify(sessions)); }, [sessions]);

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
        {tab === 'students' && <Students students={students} onAddStudent={() => { studentFormRef.current = { id: 0, name: '', phone: '', birthDate: '', parentName: '', parentPhone: '', isSibling: false, className: CLASS_OPTIONS[0], status: 'חדש' }; setEditingStudent(studentFormRef.current); setShowStudentModal(true); }} onEditStudent={(s) => { studentFormRef.current = { ...s }; setEditingStudent(studentFormRef.current); setShowStudentModal(true); }} />}
        {tab === 'payments' && <Payments payments={payments} students={students} onAddPayment={() => setShowPaymentModal(true)} />}
        {tab === 'attendance' && <Attendance sessions={sessions} students={students} onCreateSession={() => setShowSessionForm(true)} />}
      </main>

      <Dialog open={showStudentModal} onOpenChange={(open) => { if (!open) { setShowStudentModal(false); setEditingStudent(null); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingStudent?.id ? 'עריכת תלמיד' : 'הוספת תלמיד'}</DialogTitle></DialogHeader>
          {editingStudent && <div className="space-y-4">
            <div className="space-y-2"><Label>שם תלמיד</Label><Input value={editingStudent.name} onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>טלפון תלמיד</Label><Input value={editingStudent.phone} onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>תאריך לידה</Label><Input type="date" value={editingStudent.birthDate} onChange={(e) => setEditingStudent({ ...editingStudent, birthDate: e.target.value })} /></div>
            <div className="space-y-2"><Label>שם הורה</Label><Input value={editingStudent.parentName} onChange={(e) => setEditingStudent({ ...editingStudent, parentName: e.target.value })} /></div>
            <div className="space-y-2"><Label>טלפון הורה</Label><Input value={editingStudent.parentPhone} onChange={(e) => setEditingStudent({ ...editingStudent, parentPhone: e.target.value })} /></div>
            <div className="space-y-2"><Label>אחים בחוג?</Label><Select value={editingStudent.isSibling ? 'true' : 'false'} onValueChange={(v) => setEditingStudent({ ...editingStudent, isSibling: v === 'true' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="false">לא</SelectItem><SelectItem value="true">כן</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>שיוך חוג</Label><Select value={editingStudent.className} onValueChange={(v) => setEditingStudent({ ...editingStudent, className: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CLASS_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>סטטוס</Label><Select value={editingStudent.status} onValueChange={(v: Student['status']) => setEditingStudent({ ...editingStudent, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="חדש">חדש</SelectItem><SelectItem value="פעיל">פעיל</SelectItem><SelectItem value="בהקפאה">בהקפאה</SelectItem><SelectItem value="בהמתנה">בהמתנה</SelectItem></SelectContent></Select></div>
            <div className="flex gap-3"><Button className="flex-1" onClick={() => { if (!editingStudent.name) { toast.error('נא למלא שם'); return; } if (!editingStudent.id) { const newStudent = { ...editingStudent, id: genId() }; setStudents((prev) => [...prev, newStudent]); toast.success('תלמיד נוסף!'); } else { setStudents((prev) => prev.map((s) => s.id === editingStudent.id ? editingStudent : s)); toast.success('תלמיד עודכן!'); } setShowStudentModal(false); setEditingStudent(null); }}>אישור</Button><Button variant="outline" className="flex-1" onClick={() => { setShowStudentModal(false); setEditingStudent(null); }}>ביטול</Button></div>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentModal} onOpenChange={(open) => { if (!open) setShowPaymentModal(false); }}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>הוספת תשלום</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>תלמיד</Label><Select value={paymentForm.studentId} onValueChange={(v) => setPaymentForm({ ...paymentForm, studentId: v })}><SelectTrigger><SelectValue placeholder="בחר תלמיד" /></SelectTrigger><SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>סוג תשלום</Label><Select value={paymentForm.type} onValueChange={(v) => setPaymentForm({ ...paymentForm, type: v })}><SelectTrigger><SelectValue placeholder="בחר סוג" /></SelectTrigger><SelectContent><SelectItem value="ניסיון">ניסיון (700 ₪)</SelectItem><SelectItem value="חד פעמי">חד פעמי (800 ₪)</SelectItem><SelectItem value="חודשי">חודשי</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>אמצעי תשלום</Label><Select value={paymentForm.method} onValueChange={(v: 'מזומן' | 'סקאן') => setPaymentForm({ ...paymentForm, method: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="מזומן">מזומן</SelectItem><SelectItem value="סקאן">סקאן</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>תאריך</Label><Input type="date" value={paymentForm.date} onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} /></div>
            <div className="flex gap-3"><Button className="flex-1" onClick={() => { if (!paymentForm.studentId || !paymentForm.type) { toast.error('נא למלא את כל השדות'); return; } const { amount, note } = calcPayment(Number(paymentForm.studentId), paymentForm.type, paymentForm.date); setPayments((prev) => [...prev, { id: genId(), studentId: Number(paymentForm.studentId), type: paymentForm.type as Payment['type'], method: paymentForm.method, date: paymentForm.date, amount, note }]); setShowPaymentModal(false); setPaymentForm({ studentId: '', type: '', method: 'מזומן', date: new Date().toISOString().slice(0, 10) }); toast.success('תשלום נוסף!'); }}>אישור</Button><Button variant="outline" className="flex-1" onClick={() => setShowPaymentModal(false)}>ביטול</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSessionForm} onOpenChange={(open) => { if (!open) { setShowSessionForm(false); setCurrentSession(null); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{currentSession ? `נוכחות ${currentSession.date}` : 'יצירת שיעור'}</DialogTitle></DialogHeader>
          {!currentSession ? <div className="space-y-4">
            <div className="space-y-2"><Label>חוג</Label><Select value={sessionForm.className} onValueChange={(v) => setSessionForm({ ...sessionForm, className: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CLASS_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>תאריך</Label><Input type="date" value={sessionForm.date} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })} /></div>
            <div className="space-y-2"><Label>ניסיון?</Label><Select value={sessionForm.trial ? 'true' : 'false'} onValueChange={(v) => setSessionForm({ ...sessionForm, trial: v === 'true' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="false">לא</SelectItem><SelectItem value="true">כן</SelectItem></SelectContent></Select></div>
            <div className="flex gap-3"><Button className="flex-1" onClick={() => setCurrentSession({ id: genId(), className: sessionForm.className, date: sessionForm.date, trial: sessionForm.trial, students: students.filter((s) => s.className === sessionForm.className).map((s) => ({ studentId: s.id, status: 'נוכח' })) })}>המשך</Button><Button variant="outline" className="flex-1" onClick={() => setShowSessionForm(false)}>ביטול</Button></div>
          </div> : <div className="space-y-4">
            {currentSession.students.map((rec, idx) => <div key={rec.studentId} className="flex gap-2 items-center"><span className="flex-1">{students.find((s) => s.id === rec.studentId)?.name}</span><Select value={rec.status} onValueChange={(v: typeof rec.status) => { const newStudents = [...currentSession.students]; newStudents[idx] = { ...rec, status: v }; setCurrentSession({ ...currentSession, students: newStudents }); }}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="נוכח">נוכח</SelectItem><SelectItem value="לא הגיע">לא הגיע</SelectItem><SelectItem value="לא באי">לא באי</SelectItem></SelectContent></Select></div>)}
            <div className="flex gap-3"><Button className="flex-1" onClick={() => { if (currentSession.trial) { currentSession.students.forEach(({ studentId, status }) => { if (status === 'נוכח' && !payments.some((p) => p.studentId === studentId && p.type === 'ניסיון' && p.date === currentSession.date)) { const { amount, note } = calcPayment(studentId, 'ניסיון', currentSession.date); setPayments((prev) => [...prev, { id: genId(), studentId, type: 'ניסיון', method: 'מזומן', date: currentSession.date, amount, note }]); } }); } setSessions((prev) => [...prev, currentSession]); setCurrentSession(null); setShowSessionForm(false); setSessionForm({ className: CLASS_OPTIONS[0], date: new Date().toISOString().slice(0, 10), trial: false }); toast.success('שיעור נשמר!'); }}>אישור</Button><Button variant="outline" className="flex-1" onClick={() => { setCurrentSession(null); setShowSessionForm(false); }}>ביטול</Button></div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
