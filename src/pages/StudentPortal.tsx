import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Camera, Eye, EyeOff } from 'lucide-react';
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
  user_id: string;
  phone: string | null;
  birth_date: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  profile_photo_url: string | null;
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
  const [activeTab, setActiveTab] = useState<'attendance' | 'payments' | 'profile'>('attendance');
  const [loading, setLoading] = useState(true);

  // Profile editing
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editParentName, setEditParentName] = useState('');
  const [editParentPhone, setEditParentPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

      if (pendingData) {
        setPendingPayments((pendingData as PendingPayment[]).filter(p => p.status !== 'deleted_by_admin'));
      }

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
        const updated = payload.new as PendingPayment;
        setPendingPayments(prev => {
          if (updated.status === 'deleted_by_admin') {
            return prev.filter(p => p.id !== updated.id);
          }

          const exists = prev.some(p => p.id === updated.id);
          if (!exists) return [updated, ...prev];

          return prev.map(p => p.id === updated.id ? updated : p);
        });
        if (updated.status === 'approved') {
          toast.success('התשלום שלך אושר! ✅');
        } else if (updated.status === 'rejected') {
          toast.error('התשלום שלך נדחה ❌');
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'payments',
        filter: `student_id=eq.${student.id}`,
      }, (payload) => {
        const newPayment = payload.new as any;
        setPayments(prev => [{
          id: newPayment.id,
          amount: newPayment.amount,
          payment_date: newPayment.payment_date,
          payment_type: newPayment.payment_type,
          payment_method: newPayment.payment_method,
          note: newPayment.note,
        }, ...prev]);
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

  // Registration completion form state
  const [regName, setRegName] = useState('');
  const [regParentName, setRegParentName] = useState('');
  const [regParentLastName, setRegParentLastName] = useState('');
  const [regParentPhone, setRegParentPhone] = useState('');
  const [regStudentPhone, setRegStudentPhone] = useState('');
  const [regBirthDate, setRegBirthDate] = useState('');
  const [regIsSibling, setRegIsSibling] = useState(false);
  const [regSiblingId, setRegSiblingId] = useState('');
  const [existingStudents, setExistingStudents] = useState<{ id: string; name: string; last_name: string | null }[]>([]);
  const [registering, setRegistering] = useState(false);
  const [regClass, setRegClass] = useState('');

  useEffect(() => {
    if (!student && !loading && regIsSibling) {
      supabase.from('students').select('id, name, last_name').order('name').then(({ data }) => {
        if (data) setExistingStudents(data);
      });
    }
  }, [regIsSibling, student, loading]);

  const handleCompleteRegistration = async () => {
    if (!regName.trim() || !regParentName.trim() || !regParentLastName.trim() || !regParentPhone.trim()) {
      toast.error('יש למלא את כל השדות המסומנים בכוכבית');
      return;
    }
    if (!regBirthDate) {
      toast.error('יש למלא תאריך לידה');
      return;
    }
    if (!regClass) {
      toast.error('יש לבחור קבוצה');
      return;
    }
    setRegistering(true);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('register-student', {
        body: {
          studentName: regName.trim(),
          parentName: regParentName.trim(),
          parentLastName: regParentLastName.trim(),
          parentPhone: regParentPhone.trim(),
          studentPhone: regStudentPhone.trim() || null,
          birthDate: regBirthDate || null,
          siblingId: regIsSibling && regSiblingId ? regSiblingId : null,
          className: regClass,
        },
      });
      if (fnError) throw fnError;
      if (result?.error) throw new Error(result.error);
      toast.success('הפרטים נשמרו בהצלחה!');
      // Reload to fetch student data
      window.location.reload();
    } catch (err: any) {
      toast.error('שגיאה: ' + err.message);
    } finally {
      setRegistering(false);
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
    { id: 'profile' as const, label: 'הפרטים שלי' },
  ];

  const openEditProfile = () => {
    if (student) {
      setEditName(student.name || '');
      setEditPhone(student.phone || '');
      setEditBirthDate(student.birth_date || '');
      setEditParentName(student.parent_name || '');
      setEditParentPhone(student.parent_phone || '');
    }
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!student) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({
          name: editName.trim(),
          phone: editPhone.trim() || null,
          birth_date: editBirthDate || null,
          parent_name: editParentName.trim() || null,
          parent_phone: editParentPhone.trim() || null,
        })
        .eq('id', student.id);
      if (error) throw error;
      setStudent({
        ...student,
        name: editName.trim(),
        phone: editPhone.trim() || null,
        birth_date: editBirthDate || null,
        parent_name: editParentName.trim() || null,
        parent_phone: editParentPhone.trim() || null,
      });
      setShowEditProfile(false);
      toast.success('הפרטים עודכנו בהצלחה!');
    } catch (err: any) {
      toast.error('שגיאה: ' + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !student) return;
    
    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${student.id}/profile.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('profile-photos').getPublicUrl(filePath);
      const photoUrl = data.publicUrl + '?t=' + Date.now();

      const { error: updateError } = await supabase
        .from('students')
        .update({ profile_photo_url: photoUrl })
        .eq('id', student.id);
      if (updateError) throw updateError;

      setStudent({ ...student, profile_photo_url: photoUrl });
      toast.success('התמונה עודכנה בהצלחה! 📸');
    } catch (err: any) {
      toast.error('שגיאה בהעלאת תמונה: ' + err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

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
          <Card className="p-6 sm:p-8 max-w-md mx-auto">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">📝</div>
              <h2 className="text-xl font-bold text-foreground mb-1">השלם את ההרשמה</h2>
              <p className="text-muted-foreground text-sm">מלא את הפרטים הבאים כדי להשלים את ההרשמה</p>
            </div>
            <div className="space-y-4" dir="rtl">
              <div className="border-b border-border pb-4">
                <h3 className="text-sm font-bold text-foreground mb-3">👨‍👩‍👧 פרטי הורה</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1 text-foreground">שם פרטי *</label>
                    <Input value={regParentName} onChange={(e) => setRegParentName(e.target.value)} placeholder="שם ההורה" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-foreground">שם משפחה *</label>
                    <Input value={regParentLastName} onChange={(e) => setRegParentLastName(e.target.value)} placeholder="שם משפחה" />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium mb-1 text-foreground">טלפון *</label>
                  <Input type="tel" value={regParentPhone} onChange={(e) => setRegParentPhone(e.target.value)} placeholder="050-1234567" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground mb-3">🎭 פרטי התלמיד</h3>
                <div>
                  <label className="block text-xs font-medium mb-1 text-foreground">שם התלמיד *</label>
                  <Input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="שם התלמיד" />
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium mb-1 text-foreground">תאריך לידה *</label>
                  <Input type="date" value={regBirthDate} onChange={(e) => setRegBirthDate(e.target.value)} />
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium mb-1 text-foreground">טלפון תלמיד</label>
                  <Input type="tel" value={regStudentPhone} onChange={(e) => setRegStudentPhone(e.target.value)} placeholder="טלפון התלמיד (לא חובה)" />
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium mb-2 text-foreground">בחר קבוצה *</label>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setRegClass('תיאטרון 7-9')}
                      className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${regClass === 'תיאטרון 7-9' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                      🎭 גילאי 7-9
                    </button>
                    <button type="button" onClick={() => setRegClass('תיאטרון 10-14')}
                      className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${regClass === 'תיאטרון 10-14' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                      🎭 גילאי 10-14
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Checkbox id="regSibling" checked={regIsSibling} onCheckedChange={(checked) => { setRegIsSibling(checked === true); if (!checked) setRegSiblingId(''); }} />
                  <label htmlFor="regSibling" className="text-sm text-foreground cursor-pointer">אח/אחות של תלמיד קיים</label>
                </div>
                {regIsSibling && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium mb-1 text-foreground">בחר את האח/אחות</label>
                    <Select value={regSiblingId} onValueChange={setRegSiblingId}>
                      <SelectTrigger><SelectValue placeholder="בחר תלמיד קיים" /></SelectTrigger>
                      <SelectContent>
                        {existingStudents.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name} {s.last_name || ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <Button className="w-full" onClick={handleCompleteRegistration} disabled={registering}>
                {registering ? 'שומר...' : 'השלם הרשמה'}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs mt-4 text-center">האימייל שלך: {user?.email}</p>
          </Card>
        ) : (
          <>
            <Card className="p-4 sm:p-6 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-14 w-14 border-2 border-primary/20">
                      <AvatarImage src={student.profile_photo_url || undefined} alt={student.name} />
                      <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                        {student.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <label className="absolute -bottom-1 -left-1 bg-primary text-primary-foreground rounded-full p-1.5 sm:p-1 cursor-pointer hover:bg-primary/80 transition-colors shadow-md z-10">
                      <Camera size={14} className="sm:w-3 sm:h-3" />
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handlePhotoUpload}
                        disabled={uploadingPhoto}
                      />
                    </label>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{student.name} {student.last_name}</h2>
                    <p className="text-muted-foreground">{student.class_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{student.status === 'חדש' ? 'פעיל' : (student.status || 'פעיל')}</Badge>
                  <Button size="sm" onClick={() => setShowPaymentDialog(true)} className="bg-gradient-to-l from-primary to-primary-hover text-white">
                    💰 שלם
                  </Button>
                </div>
              </div>
              {uploadingPhoto && <p className="text-xs text-muted-foreground mt-2 text-center">מעלה תמונה...</p>}
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

            {activeTab === 'profile' && (
              <Card className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-foreground">הפרטים שלי</h3>
                  {!showEditProfile && (
                    <Button size="sm" variant="outline" onClick={openEditProfile}>✏️ ערוך</Button>
                  )}
                </div>
                {!showEditProfile ? (
                  <div className="space-y-3">
                    <div className="flex justify-between border-b border-border pb-2">
                      <span className="text-muted-foreground text-sm">שם התלמיד</span>
                      <span className="font-medium text-foreground">{student.name} {student.last_name}</span>
                    </div>
                    <div className="flex justify-between border-b border-border pb-2">
                      <span className="text-muted-foreground text-sm">קבוצה</span>
                      <span className="font-medium text-foreground">{student.class_name}</span>
                    </div>
                    <div className="flex justify-between border-b border-border pb-2">
                      <span className="text-muted-foreground text-sm">תאריך לידה</span>
                      <span className="font-medium text-foreground">{student.birth_date || 'לא הוזן'}</span>
                    </div>
                    <div className="flex justify-between border-b border-border pb-2">
                      <span className="text-muted-foreground text-sm">טלפון תלמיד</span>
                      <span className="font-medium text-foreground">{student.phone || 'לא הוזן'}</span>
                    </div>
                    <div className="flex justify-between border-b border-border pb-2">
                      <span className="text-muted-foreground text-sm">שם הורה</span>
                      <span className="font-medium text-foreground">{student.parent_name || 'לא הוזן'}</span>
                    </div>
                    <div className="flex justify-between pb-2">
                      <span className="text-muted-foreground text-sm">טלפון הורה</span>
                      <span className="font-medium text-foreground">{student.parent_phone || 'לא הוזן'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-foreground">שם התלמיד</label>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-foreground">תאריך לידה</label>
                      <Input type="date" value={editBirthDate} onChange={(e) => setEditBirthDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-foreground">טלפון תלמיד</label>
                      <Input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="לא חובה" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-foreground">שם הורה</label>
                      <Input value={editParentName} onChange={(e) => setEditParentName(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-foreground">טלפון הורה</label>
                      <Input type="tel" value={editParentPhone} onChange={(e) => setEditParentPhone(e.target.value)} />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button onClick={handleSaveProfile} disabled={savingProfile} className="flex-1">
                        {savingProfile ? 'שומר...' : 'שמור שינויים'}
                      </Button>
                      <Button variant="outline" onClick={() => setShowEditProfile(false)} className="flex-1">ביטול</Button>
                    </div>
                  </div>
                )}

                {/* Password change section */}
                <Card className="p-4 sm:p-6 mt-4">
                  <h3 className="text-lg font-bold text-foreground mb-4">🔒 שינוי סיסמה</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-foreground">סיסמה נוכחית</label>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="הכנס סיסמה נוכחית"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-foreground">סיסמה חדשה</label>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="הכנס סיסמה חדשה"
                          className="pl-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">לפחות 8 תווים, אות גדולה אחת באנגלית ומספר אחד</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-foreground">אישור סיסמה חדשה</label>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          placeholder="הכנס סיסמה פעם נוספת"
                          className="pl-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      disabled={changingPassword || !newPassword || !currentPassword}
                      onClick={async () => {
                        if (!currentPassword) { toast.error('יש להזין את הסיסמה הנוכחית'); return; }
                        if (newPassword.length < 8) { toast.error('הסיסמה חייבת להכיל לפחות 8 תווים'); return; }
                        if (!/[A-Z]/.test(newPassword)) { toast.error('הסיסמה חייבת להכיל לפחות אות גדולה אחת באנגלית'); return; }
                        if (!/[0-9]/.test(newPassword)) { toast.error('הסיסמה חייבת להכיל לפחות מספר אחד'); return; }
                        if (newPassword !== confirmNewPassword) { toast.error('הסיסמאות אינן תואמות'); return; }
                        setChangingPassword(true);
                        try {
                          // Re-authenticate first to refresh session
                          const { error: signInError } = await supabase.auth.signInWithPassword({
                            email: user?.email || '',
                            password: currentPassword,
                          });
                          if (signInError) throw new Error('הסיסמה הנוכחית שגויה');

                          const { error } = await supabase.auth.updateUser({ password: newPassword });
                          if (error) throw error;
                          toast.success('הסיסמה שונתה בהצלחה! 🔐');
                          setCurrentPassword('');
                          setNewPassword('');
                          setConfirmNewPassword('');
                        } catch (err: any) {
                          toast.error('שגיאה: ' + err.message);
                        } finally {
                          setChangingPassword(false);
                        }
                      }}
                    >
                      {changingPassword ? 'משנה...' : 'שנה סיסמה'}
                    </Button>
                  </div>
                </Card>
              </Card>
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
