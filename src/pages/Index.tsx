import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Student, Payment, Session } from '@/types';
import TabNavigation from '@/components/TabNavigation';
import Dashboard from '@/components/Dashboard';
import Students from '@/components/Students';
import Payments from '@/components/Payments';
import Attendance from '@/components/Attendance';
import StudentDialog from '@/components/dialogs/StudentDialog';
import PaymentDialog from '@/components/dialogs/PaymentDialog';
import SessionDialog from '@/components/dialogs/SessionDialog';
import { LogOut } from 'lucide-react';
import logo from '@/assets/logo.jpeg';
import { toast } from 'sonner';

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'dashboard' | 'students' | 'attendance' | 'payments'>('dashboard');
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  
  const [studentDialog, setStudentDialog] = useState<{ open: boolean; student?: Student }>({ open: false });
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; payment?: Payment }>({ open: false });
  const [sessionDialog, setSessionDialog] = useState<{ open: boolean; session?: Session }>({ open: false });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    const load = async () => {
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
        setStudents(
          studentsData.map((s: any) => ({
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
            status: s.status,
          }))
        );
      }

      if (paymentsData) {
        setPayments(
          paymentsData.map((p: any) => ({
            id: p.id,
            studentId: p.student_id,
            type: p.payment_type,
            method: p.payment_method,
            date: p.payment_date,
            amount: Number(p.amount),
            note: p.note || '',
            discount: Number(p.discount) || 0,
          }))
        );
      }

      if (sessionsData) {
        setSessions(
          sessionsData.map((s: any) => {
            const sessionAttendance = (attendanceData || []).filter((a: any) => a.session_id === s.id);
            return {
              id: s.id,
              className: s.class_name,
              date: s.session_date,
              trial: s.is_trial || false,
              students: sessionAttendance.map((a: any) => ({ studentId: a.student_id, status: a.status })) ,
            } as Session;
          })
        );
      }
    };

    load();
  }, [user, navigate]);

  if (!user) return null;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleSaveStudent = async (studentData: Omit<Student, 'id'> & { id?: string }) => {
    if (!user) return;
    
    if (studentData.id) {
      // Edit existing student
      const { error } = await supabase
        .from('students')
        .update({
          name: studentData.name,
          last_name: studentData.lastName,
          phone: studentData.phone,
          birth_date: studentData.birthDate,
          parent_name: studentData.parentName,
          parent_phone: studentData.parentPhone,
          is_sibling: studentData.isSibling,
          sibling_id: studentData.siblingId || null,
          class_name: studentData.className,
          status: studentData.status,
        })
        .eq('id', studentData.id)
        .eq('user_id', user.id);
      
      if (error) return toast.error('שגיאה בעדכון תלמיד');
      
      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentData.id
            ? { ...studentData, id: studentData.id }
            : s
        )
      );
      toast.success('תלמיד עודכן!');
    } else {
      // Add new student
      const { data, error } = await supabase
        .from('students')
        .insert({
          user_id: user.id,
          name: studentData.name,
          last_name: studentData.lastName,
          phone: studentData.phone,
          birth_date: studentData.birthDate,
          parent_name: studentData.parentName,
          parent_phone: studentData.parentPhone,
          is_sibling: studentData.isSibling,
          sibling_id: studentData.siblingId || null,
          class_name: studentData.className,
          status: studentData.status,
        })
        .select()
        .single();
      
      if (error) return toast.error('שגיאה בהוספת תלמיד');
      
      setStudents((prev) => [
        ...prev,
        {
          id: data.id,
          name: data.name,
          lastName: data.last_name || '',
          phone: data.phone || '',
          birthDate: data.birth_date || '',
          parentName: data.parent_name || '',
          parentPhone: data.parent_phone || '',
          isSibling: data.is_sibling || false,
          siblingId: data.sibling_id || undefined,
          className: data.class_name,
          status: data.status as Student['status'],
        },
      ]);
      toast.success('תלמיד נוסף!');
    }
    
    setStudentDialog({ open: false });
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', studentId)
      .eq('user_id', user.id);
    
    if (error) return toast.error('שגיאה במחיקת תלמיד');
    
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    toast.success('תלמיד נמחק!');
  };

  const handleSavePayment = async (paymentData: Omit<Payment, 'id'> & { id?: string }) => {
    if (!user) return;
    
    if (paymentData.id) {
      // Edit existing payment
      const { error } = await supabase
        .from('payments')
        .update({
          student_id: paymentData.studentId,
          payment_type: paymentData.type,
          payment_method: paymentData.method,
          payment_date: paymentData.date,
          amount: paymentData.amount,
          note: paymentData.note,
          discount: paymentData.discount,
        })
        .eq('id', paymentData.id)
        .eq('user_id', user.id);
      
      if (error) return toast.error('שגיאה בעדכון תשלום');
      
      setPayments((prev) =>
        prev.map((p) =>
          p.id === paymentData.id
            ? { ...paymentData, id: paymentData.id }
            : p
        )
      );
      toast.success('תשלום עודכן!');
    } else {
      // Add new payment
      const { data, error } = await supabase
        .from('payments')
        .insert({
          user_id: user.id,
          student_id: paymentData.studentId,
          payment_type: paymentData.type,
          payment_method: paymentData.method,
          payment_date: paymentData.date,
          amount: paymentData.amount,
          note: paymentData.note,
          discount: paymentData.discount,
        })
        .select()
        .single();
      
      if (error) return toast.error('שגיאה בהוספת תשלום');
      
      setPayments((prev) => [
        ...prev,
        {
          id: data.id,
          studentId: data.student_id,
          type: data.payment_type as Payment['type'],
          method: data.payment_method as Payment['method'],
          date: data.payment_date,
          amount: Number(data.amount),
          note: data.note || '',
          discount: Number(data.discount) || 0,
        },
      ]);
      toast.success('תשלום נוסף!');
    }
    
    setPaymentDialog({ open: false });
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId)
      .eq('user_id', user.id);
    
    if (error) return toast.error('שגיאה במחיקת תשלום');
    
    setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    toast.success('תשלום נמחק!');
  };

  const handleSaveSession = async (sessionData: Omit<Session, 'id'> & { id?: string }) => {
    if (!user) return;
    
    if (sessionData.id) {
      // Edit existing session
      const { error: sessionError } = await supabase
        .from('sessions')
        .update({
          class_name: sessionData.className,
          session_date: sessionData.date,
          is_trial: sessionData.trial,
        })
        .eq('id', sessionData.id)
        .eq('user_id', user.id);
      
      if (sessionError) return toast.error('שגיאה בעדכון שיעור');
      
      // Delete old attendance and insert new
      await supabase
        .from('attendance')
        .delete()
        .eq('session_id', sessionData.id)
        .eq('user_id', user.id);
      
      if (sessionData.students.length > 0) {
        const { error: attendanceError } = await supabase
          .from('attendance')
          .insert(
            sessionData.students.map((s) => ({
              user_id: user.id,
              session_id: sessionData.id!,
              student_id: s.studentId,
              status: s.status,
            }))
          );
        
        if (attendanceError) return toast.error('שגיאה בעדכון נוכחות');
      }
      
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionData.id
            ? { ...sessionData, id: sessionData.id }
            : s
        )
      );
      toast.success('שיעור עודכן!');
    } else {
      // Add new session
      const { data: sessionDbData, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          class_name: sessionData.className,
          session_date: sessionData.date,
          is_trial: sessionData.trial,
        })
        .select()
        .single();
      
      if (sessionError) return toast.error('שגיאה ביצירת שיעור');
      
      if (sessionData.students.length > 0) {
        const { error: attendanceError } = await supabase
          .from('attendance')
          .insert(
            sessionData.students.map((s) => ({
              user_id: user.id,
              session_id: sessionDbData.id,
              student_id: s.studentId,
              status: s.status,
            }))
          );
        
        if (attendanceError) return toast.error('שגיאה בהוספת תלמידים לשיעור');
      }
      
      setSessions((prev) => [
        ...prev,
        {
          id: sessionDbData.id,
          className: sessionDbData.class_name,
          date: sessionDbData.session_date,
          trial: sessionDbData.is_trial || false,
          students: sessionData.students,
        },
      ]);
      toast.success('שיעור נוצר!');
    }
    
    setSessionDialog({ open: false });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--background))' }}>
      {/* Header with Logo */}
      <div className="shadow-md border-b" style={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Koh Phangan Music & Performing Arts" className="h-12 w-auto object-contain hover:scale-105 transition-transform duration-300" />
            <div className="hidden md:block">
              <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--foreground))' }}>מערכת ניהול</h1>
              <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Koh Phangan Music & Arts</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 hover:shadow-lg hover:scale-105"
            style={{ backgroundColor: 'hsl(var(--destructive))', color: 'hsl(var(--destructive-foreground))' }}
          >
            <LogOut className="h-4 w-4" />
            <span>התנתק</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <TabNavigation activeTab={tab} onTabChange={(t) => setTab(t as any)} />

      <main className="container mx-auto px-4 py-6">
        {tab === 'dashboard' && (
          <Dashboard
            students={students}
            payments={payments}
            onAddStudent={() => setStudentDialog({ open: true })}
          />
        )}

        {tab === 'students' && (
          <Students
            students={students}
            payments={payments.map((p) => ({ studentId: p.studentId, amount: p.amount }))}
            onAddStudent={() => setStudentDialog({ open: true })}
            onEditStudent={(student) => setStudentDialog({ open: true, student })}
            onDeleteStudent={handleDeleteStudent}
          />
        )}

        {tab === 'payments' && (
          <Payments
            payments={payments}
            students={students}
            sessions={sessions}
            onAddPayment={() => setPaymentDialog({ open: true })}
            onEditPayment={(payment) => setPaymentDialog({ open: true, payment })}
            onDeletePayment={handleDeletePayment}
          />
        )}

        {tab === 'attendance' && (
          <Attendance
            sessions={sessions}
            students={students}
            payments={payments}
            onCreateSession={() => setSessionDialog({ open: true })}
            onEditSession={(session) => setSessionDialog({ open: true, session })}
            onDeleteSession={async (sessionId) => {
              if (!user) return;
              await supabase.from('attendance').delete().eq('session_id', sessionId).eq('user_id', user.id);
              const { error } = await supabase.from('sessions').delete().eq('id', sessionId).eq('user_id', user.id);
              if (error) return toast.error('שגיאה במחיקת שיעור');
              setSessions((prev) => prev.filter((s) => s.id !== sessionId));
              toast.success('שיעור נמחק!');
            }}
            onUpdateAttendance={async (sessionId, studentId, status) => {
              if (!user) return;
              const { error } = await supabase
                .from('attendance')
                .update({ status })
                .eq('session_id', sessionId)
                .eq('student_id', studentId)
                .eq('user_id', user.id);
              if (error) return toast.error('שגיאה בעדכון נוכחות');
              setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, students: s.students.map((st) => (st.studentId === studentId ? { ...st, status } : st)) } : s)));
              toast.success('נוכחות עודכנה!');
            }}
            onRemoveStudentFromSession={async (sessionId, studentId) => {
              if (!user) return;
              const { error } = await supabase
                .from('attendance')
                .delete()
                .eq('session_id', sessionId)
                .eq('student_id', studentId)
                .eq('user_id', user.id);
              if (error) return toast.error('שגיאה בהסרת תלמיד');
              setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, students: s.students.filter((st) => st.studentId !== studentId) } : s)));
              toast.success('תלמיד הוסר מהשיעור!');
            }}
          />
        )}

        {/* Dialogs */}
        <StudentDialog
          open={studentDialog.open}
          onOpenChange={(open) => setStudentDialog({ open })}
          student={studentDialog.student}
          students={students}
          onSave={handleSaveStudent}
        />

        <PaymentDialog
          open={paymentDialog.open}
          onOpenChange={(open) => setPaymentDialog({ open })}
          payment={paymentDialog.payment}
          students={students}
          onSave={handleSavePayment}
        />

        <SessionDialog
          open={sessionDialog.open}
          onOpenChange={(open) => setSessionDialog({ open })}
          session={sessionDialog.session}
          students={students}
          onSave={handleSaveSession}
        />
      </main>
    </div>
  );
}
