import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import logo from '@/assets/logo.png';

interface StudentRecord {
  id: string;
  name: string;
  last_name: string | null;
  class_name: string;
  status: string | null;
}

interface AttendanceRecord {
  id: string;
  session_id: string;
  status: string;
  session?: { session_date: string; class_name: string; is_trial: boolean };
}

interface PaymentRecord {
  id: string;
  amount: number;
  payment_date: string;
  payment_type: string;
  payment_method: string;
  note: string | null;
}

export default function StudentPortal() {
  const { user, signOut } = useAuth();
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'attendance' | 'payments'>('attendance');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      // Get linked student record
      const { data: studentData } = await supabase
        .from('students')
        .select('*')
        .eq('auth_user_id', user.id)
        .limit(1)
        .single();

      if (!studentData) {
        setLoading(false);
        return;
      }

      setStudent(studentData);

      // Get attendance with session info
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('id, session_id, status, sessions(session_date, class_name, is_trial)')
        .eq('student_id', studentData.id)
        .order('created_at', { ascending: false });

      if (attendanceData) {
        setAttendance(attendanceData.map((a: any) => ({
          id: a.id,
          session_id: a.session_id,
          status: a.status,
          session: a.sessions,
        })));
      }

      // Get payments
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('id, amount, payment_date, payment_type, payment_method, note')
        .eq('student_id', studentData.id)
        .order('payment_date', { ascending: false });

      if (paymentsData) {
        setPayments(paymentsData);
      }

      setLoading(false);
    };

    load();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-foreground">טוען...</div>
      </div>
    );
  }

  const tabs = [
    { id: 'attendance' as const, label: 'נוכחות' },
    { id: 'payments' as const, label: 'תשלומים' },
  ];

  const statusMap: Record<string, string> = {
    'נוכח': 'bg-green-100 text-green-800',
    'לא הגיע': 'bg-red-100 text-red-800',
    'לא באי': 'bg-yellow-100 text-yellow-800',
    'עזב': 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background" dir="rtl">
      <header className="bg-card/80 backdrop-blur-md border-b border-border shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4 animate-fade-in">
            <img src={logo} alt="לוגו" className="h-8 sm:h-12 object-contain drop-shadow-lg" />
            <h1 className="text-base sm:text-2xl font-bold bg-gradient-to-l from-primary to-magenta bg-clip-text text-transparent">
              האזור האישי שלי
            </h1>
          </div>
          <Button
            onClick={signOut}
            size="sm"
            className="bg-gradient-to-l from-magenta to-magenta-hover text-white font-bold text-xs sm:text-lg px-3 sm:px-8"
          >
            התנתק
          </Button>
        </div>
      </header>

      {/* Student info card */}
      <div className="container mx-auto px-2 sm:px-4 py-4">
        {!student ? (
          <Card className="p-8 text-center">
            <h2 className="text-xl font-bold text-foreground mb-2">החשבון שלך עדיין לא מקושר</h2>
            <p className="text-muted-foreground">פנה למנהל כדי לקשר את החשבון שלך לפרופיל התלמיד.</p>
          </Card>
        ) : (
          <>
            <Card className="p-4 sm:p-6 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{student.name} {student.last_name}</h2>
                  <p className="text-muted-foreground">{student.class_name}</p>
                </div>
                <Badge variant="outline" className="text-sm">
                  {student.status || 'פעיל'}
                </Badge>
              </div>
            </Card>

            {/* Tab navigation */}
            <div className="flex justify-center gap-2 sm:gap-3 mb-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base transition-all duration-300 whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-l from-magenta to-magenta-hover text-white shadow-xl scale-105 glow-magenta'
                      : 'bg-secondary text-secondary-foreground hover:bg-accent hover:scale-105 hover:shadow-md'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Attendance tab */}
            {activeTab === 'attendance' && (
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">תאריך</TableHead>
                      <TableHead className="text-right">כיתה</TableHead>
                      <TableHead className="text-right">סטטוס</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          אין רשומות נוכחות עדיין
                        </TableCell>
                      </TableRow>
                    ) : (
                      attendance.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.session?.session_date || '-'}</TableCell>
                          <TableCell>{record.session?.class_name || '-'}</TableCell>
                          <TableCell>
                            <Badge className={statusMap[record.status] || ''} variant="outline">
                              {record.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            )}

            {/* Payments tab */}
            {activeTab === 'payments' && (
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">תאריך</TableHead>
                      <TableHead className="text-right">סוג</TableHead>
                      <TableHead className="text-right">שיטה</TableHead>
                      <TableHead className="text-right">סכום</TableHead>
                      <TableHead className="text-right">הערה</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          אין רשומות תשלום עדיין
                        </TableCell>
                      </TableRow>
                    ) : (
                      payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.payment_date}</TableCell>
                          <TableCell>{p.payment_type}</TableCell>
                          <TableCell>{p.payment_method}</TableCell>
                          <TableCell>₪{p.amount}</TableCell>
                          <TableCell>{p.note || '-'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
