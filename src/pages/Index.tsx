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
        {tab === 'dashboard' && <Dashboard students={students} payments={payments} onAddStudent={() => toast('פעולה תתווסף בהמשך')} />}

        {tab === 'students' && (
          <Students
            students={students}
            payments={payments.map((p) => ({ studentId: p.studentId, amount: p.amount }))}
            onAddStudent={() => toast('הוספת תלמיד תוחזר בהמשך')}
            onEditStudent={() => toast('עריכת תלמיד תוחזר בהמשך')}
            onDeleteStudent={() => toast('מחיקת תלמיד תוחזר בהמשך')}
          />
        )}

        {tab === 'payments' && (
          <Payments
            payments={payments}
            students={students}
            sessions={sessions}
            onAddPayment={() => toast('הוספת תשלום תוחזר בהמשך')}
            onEditPayment={() => toast('עריכת תשלום תוחזר בהמשך')}
            onDeletePayment={() => toast('מחיקת תשלום תוחזר בהמשך')}
          />
        )}

        {tab === 'attendance' && (
          <Attendance
            sessions={sessions}
            students={students}
            payments={payments}
            onCreateSession={() => toast('יצירת שיעור תוחזר בהמשך')}
            onEditSession={() => toast('עריכת שיעור תוחזר בהמשך')}
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
      </main>
    </div>
  );
}
