import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import logo from '@/assets/logo.png';
import { toast } from 'sonner';

interface StudentRecord {
  id: string;
  name: string;
  last_name: string | null;
  class_name: string;
  status: string | null;
  user_id: string; // admin who owns this student
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

interface PendingPayment {
  id: string;
  payment_type: string;
  status: string;
  created_at: string;
}

export default function StudentPortal() {
  const { user, signOut } = useAuth();
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [activeTab, setActiveTab] = useState<'attendance' | 'payments'>('attendance');
  const [loading, setLoading] = useState(true);

  // Payment dialog
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'promptpay' | null>(null);
  const [selectedPaymentType, setSelectedPaymentType] = useState<string>('');
  const [promptPayUrl, setPromptPayUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
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

      setStudent(studentData as any);

      // Attendance
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('id, session_id, status, sessions(session_date, class_name, is_trial)')
        .eq('student_id', studentData.id)
        .order('created_at', { ascending: false });

      if (attendanceData) {
        setAttendance(attendanceData.map((a: any) => ({
          id: a.id, session_id: a.session_id, status: a.status, session: a.sessions,
        })));
      }

      // Payments
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('id, amount, payment_date, payment_type, payment_method, note')
        .eq('student_id', studentData.id)
        .order('payment_date', { ascending: false });

      if (paymentsData) setPayments(paymentsData);

      // Pending payments
      const { data: pendingData } = await supabase
        .from('pending_payments')
        .select('*')
        .eq('student_id', studentData.id)
        .order('created_at', { ascending: false });

      if (pendingData) setPendingPayments(pendingData);

      // PromptPay QR
      const { data: files } = await supabase.storage
        .from('admin-settings')
        .list('', { limit: 10 });

      const ppFile = files?.find(f => f.name.startsWith('promptpay'));
      if (ppFile) {
        const { data } = supabase.storage.from('admin-settings').getPublicUrl(ppFile.name);
        setPromptPayUrl(data.publicUrl);
      }

      setLoading(false);
    };

    load();
  }, [user]);

  // Realtime for pending payment updates
  useEffect(() => {
    if (!student) return;
    const channel = supabase
      .channel('pending-payments-student')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'pending_payments',
        filter: `student_id=eq.${student.id}`,
      }, (payload) => {
        const updated = payload.new as any;
        setPendingPayments(prev => prev.map(p => p.id === updated.id ? updated : p));
        if (updated.status === 'approved') {
          toast.success('התשלום שלך אושר! ✅');
        } else if (updated.status === 'rejected') {
          toast.error('התשלום שלך נדחה ❌');
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [student]);

  const handleCashPaymentRequest = async () => {
    if (!student || !selectedPaymentType) {
      toast.error('בחר סוג תשלום');
      return;
    }
    setSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('pending_payments')
        .insert({
          student_id: student.id,
          admin_user_id: student.user_id,
          payment_type: selectedPaymentType,
          payment_method: 'מזומן',
        })
        .select()
        .single();

      if (error) throw error;

      setPendingPayments(prev => [data, ...prev]);
      toast.success('בקשת תשלום נשלחה למנהל! ⏳');
      setShowPaymentDialog(false);
      setPaymentMethod(null);
      setSelectedPaymentType('');
    } catch (error: any) {
      toast.error('שגיאה: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

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

  const pendingStatusMap: Record<string, { label: string; className: string }> = {
    'pending': { label: 'ממתין לאישור', className: 'bg-yellow-100 text-yellow-800' },
    'approved': { label: 'אושר ✅', className: 'bg-green-100 text-green-800' },
    'rejected': { label: 'נדחה ❌', className: 'bg-red-100 text-red-800' },
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
          <Button onClick={signOut} size="sm" className="bg-gradient-to-l from-magenta to-magenta-hover text-white font-bold text-xs sm:text-lg px-3 sm:px-8">
            התנתק
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-2 sm:px-4 py-4">
        {!student ? (
          <Card className="p-8 text-center">
            <div className="text-6xl mb-4">⏳</div>
            <h2 className="text-xl font-bold text-foreground mb-2">הפרופיל שלך בהכנה</h2>
            <p className="text-muted-foreground">הפרטים שלך נשלחו למנהל. תוכל לגשת לאזור האישי ברגע שתשובץ לכיתה.</p>
            <p className="text-muted-foreground text-sm mt-2">האימייל שלך: {user?.email}</p>
          </Card>
        ) : (
          <>
            <Card className="p-4 sm:p-6 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{student.name} {student.last_name}</h2>
                  <p className="text-muted-foreground">{student.class_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{student.status || 'פעיל'}</Badge>
                  <Button size="sm" onClick={() => setShowPaymentDialog(true)} className="bg-gradient-to-l from-primary to-primary-hover text-white">
                    💰 שלם
                  </Button>
                </div>
              </div>
            </Card>

            {/* Pending payments banner */}
            {pendingPayments.filter(p => p.status === 'pending').length > 0 && (
              <Card className="p-3 mb-4 bg-yellow-50 border-yellow-200">
                <p className="text-sm font-medium text-yellow-800">
                  ⏳ יש לך {pendingPayments.filter(p => p.status === 'pending').length} בקשות תשלום ממתינות לאישור המנהל
                </p>
              </Card>
            )}

            {/* Tab navigation */}
            <div className="flex justify-center gap-2 sm:gap-3 mb-4">
              {tabs.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
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
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">אין רשומות נוכחות עדיין</TableCell></TableRow>
                    ) : attendance.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.session?.session_date || '-'}</TableCell>
                        <TableCell>{r.session?.class_name || '-'}</TableCell>
                        <TableCell><Badge className={statusMap[r.status] || ''} variant="outline">{r.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}

            {activeTab === 'payments' && (
              <div className="space-y-4">
                {/* Pending payment requests */}
                {pendingPayments.length > 0 && (
                  <Card className="overflow-hidden">
                    <div className="p-3 bg-accent border-b"><h3 className="font-bold text-sm">בקשות תשלום</h3></div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">תאריך</TableHead>
                          <TableHead className="text-right">סוג</TableHead>
                          <TableHead className="text-right">סטטוס</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingPayments.map((p) => {
                          const s = pendingStatusMap[p.status] || { label: p.status, className: '' };
                          return (
                            <TableRow key={p.id}>
                              <TableCell>{new Date(p.created_at).toLocaleDateString('he-IL')}</TableCell>
                              <TableCell>{p.payment_type}</TableCell>
                              <TableCell><Badge className={s.className} variant="outline">{s.label}</Badge></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Card>
                )}

                {/* Approved payments */}
                <Card className="overflow-hidden">
                  <div className="p-3 bg-accent border-b"><h3 className="font-bold text-sm">תשלומים מאושרים</h3></div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">תאריך</TableHead>
                        <TableHead className="text-right">סוג</TableHead>
                        <TableHead className="text-right">שיטה</TableHead>
                        <TableHead className="text-right">סכום</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">אין תשלומים מאושרים עדיין</TableCell></TableRow>
                      ) : payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.payment_date}</TableCell>
                          <TableCell>{p.payment_type}</TableCell>
                          <TableCell>{p.payment_method}</TableCell>
                          <TableCell>฿{p.amount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            )}
          </>
        )}
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={(open) => { if (!open) { setShowPaymentDialog(false); setPaymentMethod(null); setSelectedPaymentType(''); } }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>בחר אמצעי תשלום</DialogTitle></DialogHeader>

          {!paymentMethod ? (
            <div className="space-y-3">
              <Button className="w-full h-16 text-lg" variant="outline" onClick={() => setPaymentMethod('cash')}>
                💵 תשלום במזומן
              </Button>
              <Button className="w-full h-16 text-lg" variant="outline" onClick={() => setPaymentMethod('promptpay')}>
                📱 PromptPay
              </Button>
            </div>
          ) : paymentMethod === 'cash' ? (
            <div className="space-y-4">
              <div className="text-center text-4xl">💵</div>
              <h3 className="font-bold text-lg text-center">דיווח תשלום במזומן</h3>
              <p className="text-muted-foreground text-sm text-center">
                בחר סוג תשלום ושלח בקשה למנהל. התשלום ייכנס לתוקף רק לאחר אישור המנהל.
              </p>
              <div className="space-y-2">
                <label className="block text-sm font-medium">סוג תשלום</label>
                <Select value={selectedPaymentType} onValueChange={setSelectedPaymentType}>
                  <SelectTrigger><SelectValue placeholder="בחר סוג" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="חד פעמי">חד פעמי</SelectItem>
                    <SelectItem value="חודשי">חודשי (מנוי)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleCashPaymentRequest} disabled={submitting || !selectedPaymentType}>
                {submitting ? 'שולח...' : 'שלח בקשת תשלום למנהל'}
              </Button>
              <Button variant="ghost" onClick={() => setPaymentMethod(null)} className="w-full">← חזור</Button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div className="text-4xl">📱</div>
              <h3 className="font-bold text-lg">PromptPay</h3>
              <p className="text-muted-foreground text-sm">סרוק את הקוד או הורד את התמונה לביצוע העברה</p>
              {promptPayUrl ? (
                <div className="space-y-3">
                  <img src={promptPayUrl} alt="PromptPay QR" className="mx-auto max-w-[250px] rounded-lg shadow-lg" />
                  <a href={promptPayUrl} download="promptpay-qr.png" className="inline-block">
                    <Button variant="outline" size="sm">📥 הורד תמונה</Button>
                  </a>
                </div>
              ) : (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-muted-foreground">קוד PromptPay עדיין לא הוגדר. פנה למנהל.</p>
                </div>
              )}
              <Button variant="ghost" onClick={() => setPaymentMethod(null)} className="w-full">← חזור</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
