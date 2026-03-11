import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Camera, Eye, EyeOff, ScanLine } from 'lucide-react';
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
import QrScanner from '@/components/QrScanner';
import { toast } from 'sonner';
import { getSignedProfilePhotoUrl, extractProfilePhotoPath, uploadProfilePhoto } from '@/lib/storageHelpers';
import { getPaymentPrice, isMonthlyPaymentType } from '@/types';

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
  is_sibling: boolean | null;
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
  payment_proof_url: string | null;
}

interface PendingPayment {
  id: string;
  payment_type: string;
  payment_method: string;
  status: string;
  created_at: string;
  payment_proof_url: string | null;
}

export default function StudentPortal() {
  const { user, signOut } = useAuth();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [selectedStudentIdx, setSelectedStudentIdx] = useState(0);
  const student = students[selectedStudentIdx] || null;
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
  const [editParentFirstName, setEditParentFirstName] = useState('');
  const [editParentLastName, setEditParentLastName] = useState('');
  const [editParentPhone, setEditParentPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
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
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [viewingProofUrl, setViewingProofUrl] = useState<string | null>(null);

  // Add sibling dialog
  const [showAddSibling, setShowAddSibling] = useState(false);
  const [siblingName, setSiblingName] = useState('');
  const [siblingBirthDate, setSiblingBirthDate] = useState('');
  const [siblingPhone, setSiblingPhone] = useState('');
  const [siblingClass, setSiblingClass] = useState('');
  const [addingSibling, setAddingSibling] = useState(false);

  // Load all students for this user
  useEffect(() => {
    if (!user) return;
    const loadStudents = async () => {
      const { data: studentData } = await supabase
        .from('students')
        .select('*')
        .eq('auth_user_id', user.id);

      if (studentData && studentData.length > 0) {
        // Resolve signed URLs for profile photos
        const studentsWithSignedUrls = await Promise.all(
          studentData.map(async (s: any) => {
            let signedPhotoUrl = s.profile_photo_url;
            if (s.profile_photo_url) {
              // If it's a path (not a full URL), get signed URL
              const isPath = !s.profile_photo_url.startsWith('http');
              if (isPath) {
                signedPhotoUrl = await getSignedProfilePhotoUrl(s.profile_photo_url);
              } else {
                // Extract path from existing URL and get new signed URL
                const path = extractProfilePhotoPath(s.profile_photo_url);
                if (path) {
                  signedPhotoUrl = await getSignedProfilePhotoUrl(path);
                }
              }
            }
            return { ...s, profile_photo_url: signedPhotoUrl };
          })
        );
        setStudents(studentsWithSignedUrls as any);
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
    loadStudents();
  }, [user]);

  // Load student-specific data when selected student changes
  useEffect(() => {
    if (!student) return;
    const loadStudentData = async () => {
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('id, session_id, status, sessions(session_date, class_name, is_trial)')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false });

      setAttendance(attendanceData ? attendanceData.map((a: any) => ({
        id: a.id, session_id: a.session_id, status: a.status, session: a.sessions,
      })) : []);

      const { data: paymentsData } = await supabase
        .from('payments')
        .select('id, amount, payment_date, payment_type, payment_method, note, payment_proof_url')
        .eq('student_id', student.id)
        .order('payment_date', { ascending: false });

      setPayments((paymentsData as PaymentRecord[]) || []);

      const { data: pendingData } = await supabase
        .from('pending_payments')
        .select('*')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false });

      setPendingPayments(
        ((pendingData as PendingPayment[]) || []).filter(p => p.status !== 'deleted_by_admin')
      );
    };
    loadStudentData();
  }, [student?.id]);

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
          payment_proof_url: newPayment.payment_proof_url,
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

  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  const handlePromptPayPaymentRequest = async () => {
    if (!student || !selectedPaymentType || !proofFile) {
      toast.error('בחר סוג תשלום והעלה צילום מסך');
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(proofFile.type)) {
      toast.error('ניתן להעלות רק תמונות JPEG, PNG או WebP');
      return;
    }
    setSubmitting(true);

    try {
      // Upload proof image
      const fileExt = proofFile.name.split('.').pop()?.toLowerCase();
      const filePath = `${student.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, proofFile, { contentType: proofFile.type, upsert: true });
      if (uploadError) throw uploadError;

      const { data: signedData, error: signedError } = await supabase.storage.from('payment-proofs').createSignedUrl(filePath, 60 * 60 * 24 * 365);
      const proofUrl = signedData?.signedUrl || filePath;

      // Create pending payment with proof
      const { data, error } = await supabase
        .from('pending_payments')
        .insert({
          student_id: student.id,
          admin_user_id: student.user_id,
          payment_type: selectedPaymentType,
          payment_method: 'סקאן',
          payment_proof_url: proofUrl,
        })
        .select()
        .single();

      if (error) throw error;

      setPendingPayments(prev => [data as PendingPayment, ...prev]);
      toast.success('אישור התשלום נשלח למנהל! ⏳');
      setShowPaymentDialog(false);
      setPaymentMethod(null);
      setSelectedPaymentType('');
      setProofFile(null);
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
      supabase.functions.invoke('list-siblings').then(({ data, error }) => {
        if (!error && data?.students) setExistingStudents(data.students);
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
      const { data: newStudents } = await supabase
        .from('students')
        .select('*')
        .eq('auth_user_id', user!.id);
      if (newStudents && newStudents.length > 0) {
        setStudents(newStudents as any);
        setSelectedStudentIdx(0);
      }
    } catch (err: any) {
      toast.error('שגיאה: ' + err.message);
    } finally {
      setRegistering(false);
    }
  };

  const handleAddSibling = async () => {
    if (!siblingName.trim() || !siblingBirthDate || !siblingClass) {
      toast.error('יש למלא שם, תאריך לידה וקבוצה');
      return;
    }
    setAddingSibling(true);
    try {
      const firstStudent = students[0];
      const parentNameParts = (firstStudent?.parent_name || '').split(' ');
      const parentFirst = parentNameParts[0] || '';
      const parentLast = firstStudent?.last_name || parentNameParts.slice(1).join(' ') || '';

      const { data: result, error } = await supabase.functions.invoke('register-student', {
        body: {
          studentName: siblingName.trim(),
          parentName: parentFirst,
          parentLastName: parentLast,
          parentPhone: firstStudent?.parent_phone || '',
          studentPhone: siblingPhone.trim() || null,
          birthDate: siblingBirthDate,
          siblingId: firstStudent?.id || null,
          className: siblingClass,
        },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      toast.success('האח/אחות נרשמו בהצלחה! 🎉');
      setShowAddSibling(false);
      setSiblingName('');
      setSiblingBirthDate('');
      setSiblingPhone('');
      setSiblingClass('');
      const { data: newStudents } = await supabase
        .from('students')
        .select('*')
        .eq('auth_user_id', user!.id);
      if (newStudents) {
        setStudents(newStudents as any);
        setSelectedStudentIdx(newStudents.length - 1);
      }
    } catch (err: any) {
      toast.error('שגיאה: ' + err.message);
    } finally {
      setAddingSibling(false);
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
      const parentParts = (student.parent_name || '').split(' ');
      setEditParentFirstName(parentParts[0] || '');
      setEditParentLastName(student.last_name || parentParts.slice(1).join(' ') || '');
      setEditParentPhone(student.parent_phone || '');
    }
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!student) return;
    setSavingProfile(true);
    try {
      const fullParentName = (editParentFirstName.trim() + ' ' + editParentLastName.trim()).trim();
      const newLastName = editParentLastName.trim() || student.last_name;
      
      // Use RPC function for secure field updates (prevents modifying is_sibling, class_name, status)
      const { error } = await supabase.rpc('update_own_student_profile', {
        _student_id: student.id,
        _name: editName.trim() || null,
        _last_name: newLastName || null,
        _phone: editPhone.trim() || null,
        _birth_date: editBirthDate || null,
        _parent_name: fullParentName || null,
        _parent_phone: editParentPhone.trim() || null,
        _profile_photo_url: null, // Keep existing photo
      });
      
      if (error) throw error;
      setStudents(prev => prev.map((s, idx) =>
        idx === selectedStudentIdx ? {
          ...s,
          name: editName.trim(),
          last_name: newLastName,
          phone: editPhone.trim() || null,
          birth_date: editBirthDate || null,
          parent_name: fullParentName || null,
          parent_phone: editParentPhone.trim() || null,
        } : s
      ));
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

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('ניתן להעלות רק תמונות JPEG, PNG או WebP');
      return;
    }
    
    setUploadingPhoto(true);
    try {
      // Upload and get signed URL
      const result = await uploadProfilePhoto(student.id, file);
      if (!result) throw new Error('Failed to upload photo');
      
      // Update the database with the file path (not the URL)
      const filePath = `${student.id}/profile.${file.name.split('.').pop()?.toLowerCase()}`;
      
      // Use RPC to update profile photo URL securely
      const { error: updateError } = await supabase.rpc('update_own_student_profile', {
        _student_id: student.id,
        _name: null,
        _last_name: null,
        _phone: null,
        _birth_date: null,
        _parent_name: null,
        _parent_phone: null,
        _profile_photo_url: filePath, // Store the path, not the signed URL
      });
      if (updateError) throw updateError;

      setStudents(prev => prev.map((s, idx) =>
        idx === selectedStudentIdx ? { ...s, profile_photo_url: result.url } : s
      ));
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
          <Button onClick={() => signOut()} size="sm" className="bg-gradient-to-l from-magenta to-magenta-hover text-white font-bold text-xs sm:text-lg px-3 sm:px-8">
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
            {/* Student selector */}
            {students.length > 1 && (
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                {students.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStudentIdx(idx)}
                    className={`px-4 py-2 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                      idx === selectedStudentIdx
                        ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                        : 'bg-secondary text-secondary-foreground hover:bg-accent'
                    }`}
                  >
                    {s.name} {s.last_name || ''}
                  </button>
                ))}
              </div>
            )}

            <Card className="p-4 sm:p-6 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar
                      className={`h-14 w-14 border-2 border-primary/20 ${student.profile_photo_url ? 'cursor-pointer hover:ring-2 hover:ring-primary transition-all' : ''}`}
                      onClick={() => { if (student.profile_photo_url) setViewingPhoto(true); }}
                    >
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
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <Badge variant="outline">{student.status === 'חדש' ? 'פעיל' : (student.status || 'פעיל')}</Badge>
                  <Button size="sm" onClick={() => setShowQrScanner(true)} className="bg-gradient-to-l from-green-600 to-green-500 text-white">
                    <ScanLine size={16} /> נוכחות
                  </Button>
                  <Button size="sm" onClick={() => setShowPaymentDialog(true)} className="bg-gradient-to-l from-primary to-primary-hover text-white">
                    💰 שלם
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setSiblingName('');
                    setSiblingBirthDate('');
                    setSiblingPhone('');
                    setSiblingClass('');
                    setShowAddSibling(true);
                  }}>
                    ➕ אח/אחות
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
                          <TableHead className="text-right">אישור</TableHead>
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
                              <TableCell>
                                {p.payment_proof_url ? (
                                  <img
                                    src={p.payment_proof_url}
                                    alt="אישור"
                                    className="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80"
                                    onClick={() => setViewingProofUrl(p.payment_proof_url)}
                                  />
                                ) : '-'}
                              </TableCell>
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
                        <TableHead className="text-right">אישור</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">אין תשלומים מאושרים עדיין</TableCell></TableRow>
                      ) : payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.payment_date}</TableCell>
                          <TableCell>{p.payment_type}</TableCell>
                          <TableCell>{p.payment_method}</TableCell>
                          <TableCell>฿{p.amount}</TableCell>
                          <TableCell>
                            {p.payment_proof_url ? (
                              <img
                                src={p.payment_proof_url}
                                alt="אישור"
                                className="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80"
                                onClick={() => setViewingProofUrl(p.payment_proof_url)}
                              />
                            ) : '-'}
                          </TableCell>
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
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1 text-foreground">שם פרטי הורה</label>
                        <Input value={editParentFirstName} onChange={(e) => setEditParentFirstName(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-foreground">שם משפחה</label>
                        <Input value={editParentLastName} onChange={(e) => setEditParentLastName(e.target.value)} />
                      </div>
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

      {/* Photo viewer dialog */}
      <Dialog open={viewingPhoto} onOpenChange={setViewingPhoto}>
        <DialogContent className="max-w-md p-2" dir="rtl">
          {student?.profile_photo_url && (
            <div className="text-center">
              <img
                src={student.profile_photo_url}
                alt={student.name}
                className="w-full max-h-[70vh] object-contain rounded-lg"
              />
              <p className="mt-3 font-bold text-foreground text-lg">{student.name} {student.last_name}</p>
              <label className="mt-3 inline-block">
                <Button variant="outline" size="sm" disabled={uploadingPhoto} asChild>
                  <span className="cursor-pointer">
                    📷 {uploadingPhoto ? 'מעלה...' : 'שנה תמונה'}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => { handlePhotoUpload(e); setViewingPhoto(false); }}
                      disabled={uploadingPhoto}
                    />
                  </span>
                </Button>
              </label>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* QR Scanner */}
      <QrScanner
        open={showQrScanner}
        onClose={() => setShowQrScanner(false)}
        onScan={(url) => {
          setShowQrScanner(false);
          if (url.includes('/mark-attendance') || url.includes('/scan/')) {
            const path = new URL(url).pathname;
            window.location.href = path;
          } else {
            toast.error('קוד QR לא תקין');
          }
        }}
      />

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={(open) => { if (!open) { setShowPaymentDialog(false); setPaymentMethod(null); setSelectedPaymentType(''); } }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>בחר אמצעי תשלום</DialogTitle></DialogHeader>

          {(() => {
            const isSibling = !!student?.is_sibling;
            const now = new Date();
            const day = now.getDate();
            const isMonthlyWindowOpen = day >= 25 || day <= 5;
            const isMonthlySelected = isMonthlyPaymentType(selectedPaymentType);

            const priceDisplay = selectedPaymentType
              ? `฿${getPaymentPrice(selectedPaymentType, isSibling).toLocaleString()}`
              : null;

            const paymentTypeSelector = (
              <div className="space-y-2">
                <label className="block text-sm font-medium">סוג תשלום</label>
                <Select value={selectedPaymentType} onValueChange={setSelectedPaymentType}>
                  <SelectTrigger><SelectValue placeholder="בחר סוג" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="חד פעמי">חד פעמי — ฿{getPaymentPrice('חד פעמי', isSibling).toLocaleString()}</SelectItem>
                    <SelectItem value="חודשי דו שבועי">חודשי דו שבועי — ฿{getPaymentPrice('חודשי דו שבועי', isSibling).toLocaleString()}</SelectItem>
                    <SelectItem value="חודשי חד שבועי">חודשי חד שבועי — ฿{getPaymentPrice('חודשי חד שבועי', isSibling).toLocaleString()}</SelectItem>
                  </SelectContent>
                </Select>
                {isSibling && selectedPaymentType && (
                  <p className="text-xs text-green-600">🏷️ הנחת אחים מופעלת</p>
                )}
                {isMonthlySelected && !isMonthlyWindowOpen && (
                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <p className="text-sm text-destructive font-medium">⛔ חלון התשלום למנוי חודשי סגור.</p>
                    <p className="text-xs text-destructive/80 mt-1">ניתן לשלם מנוי חודשי מה-25 לחודש הקודם ועד ה-5 לחודש הנוכחי. פנה למנהל לאישור מיוחד.</p>
                  </div>
                )}
                {priceDisplay && !isMonthlySelected && (
                  <p className="text-sm font-bold text-center mt-2">סכום לתשלום: {priceDisplay}</p>
                )}
                {priceDisplay && isMonthlySelected && isMonthlyWindowOpen && (
                  <p className="text-sm font-bold text-center mt-2">סכום לתשלום: {priceDisplay}</p>
                )}
              </div>
            );

            const isBlocked = isMonthlySelected && !isMonthlyWindowOpen;

            if (!paymentMethod) {
              return (
                <div className="space-y-3">
                  <Button className="w-full h-16 text-lg" variant="outline" onClick={() => setPaymentMethod('cash')}>
                    💵 תשלום במזומן
                  </Button>
                  <Button className="w-full h-16 text-lg" variant="outline" onClick={() => setPaymentMethod('promptpay')}>
                    📱 PromptPay
                  </Button>
                </div>
              );
            }

            if (paymentMethod === 'cash') {
              return (
                <div className="space-y-4">
                  <div className="text-center text-4xl">💵</div>
                  <h3 className="font-bold text-lg text-center">דיווח תשלום במזומן</h3>
                  <p className="text-muted-foreground text-sm text-center">
                    בחר סוג תשלום ושלח בקשה למנהל. התשלום ייכנס לתוקף רק לאחר אישור המנהל.
                  </p>
                  {paymentTypeSelector}
                  <Button className="w-full" onClick={handleCashPaymentRequest} disabled={submitting || !selectedPaymentType || isBlocked}>
                    {submitting ? 'שולח...' : 'שלח בקשת תשלום למנהל'}
                  </Button>
                  <Button variant="ghost" onClick={() => setPaymentMethod(null)} className="w-full">← חזור</Button>
                </div>
              );
            }

            // promptpay
            return (
              <div className="space-y-4 text-center">
                <div className="text-4xl">📱</div>
                <h3 className="font-bold text-lg">PromptPay</h3>
                <p className="text-muted-foreground text-sm">סרוק את הקוד, בצע העברה ולאחר מכן העלה צילום מסך של האישור</p>
                {promptPayUrl && (
                  <div className="space-y-3">
                    <img src={promptPayUrl} alt="PromptPay QR" className="mx-auto max-w-[250px] rounded-lg shadow-lg" />
                    <a href={promptPayUrl} download="promptpay-qr.png" className="inline-block">
                      <Button variant="outline" size="sm">📥 הורד תמונה</Button>
                    </a>
                  </div>
                )}
                {!promptPayUrl && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-muted-foreground">קוד PromptPay עדיין לא הוגדר. פנה למנהל.</p>
                  </div>
                )}

                <div className="border-t border-border pt-4 space-y-3 text-right">
                  <h4 className="font-bold text-sm">לאחר התשלום:</h4>
                  {paymentTypeSelector}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">העלה צילום מסך של אישור התשלום</label>
                    <label className="block">
                      <div className={`border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${proofFile ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-border hover:border-primary'}`}>
                        {proofFile ? (
                          <div className="flex items-center gap-2 justify-center">
                            <span className="text-green-600">✅</span>
                            <span className="text-sm font-medium">{proofFile.name}</span>
                            <button type="button" onClick={(e) => { e.preventDefault(); setProofFile(null); }} className="text-destructive text-xs hover:underline">הסר</button>
                          </div>
                        ) : (
                          <div className="text-center">
                            <span className="text-2xl">📷</span>
                            <p className="text-sm text-muted-foreground mt-1">לחץ לבחירת תמונה מהגלריה</p>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                        />
                      </div>
                    </label>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handlePromptPayPaymentRequest}
                    disabled={submitting || !selectedPaymentType || !proofFile || isBlocked}
                  >
                    {submitting ? 'שולח...' : '📤 שלח אישור תשלום למנהל'}
                  </Button>
                </div>
                <Button variant="ghost" onClick={() => { setPaymentMethod(null); setProofFile(null); }} className="w-full">← חזור</Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Add sibling dialog */}
      <Dialog open={showAddSibling} onOpenChange={setShowAddSibling}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>➕ הוסף אח/אחות</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1 text-foreground">שם התלמיד *</label>
              <Input value={siblingName} onChange={(e) => setSiblingName(e.target.value)} placeholder="שם האח/אחות" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-foreground">תאריך לידה *</label>
              <Input type="date" value={siblingBirthDate} onChange={(e) => setSiblingBirthDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-foreground">טלפון (לא חובה)</label>
              <Input type="tel" value={siblingPhone} onChange={(e) => setSiblingPhone(e.target.value)} placeholder="טלפון" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-2 text-foreground">בחר קבוצה *</label>
              <div className="flex gap-3">
                <button type="button" onClick={() => setSiblingClass('תיאטרון 7-9')}
                  className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${siblingClass === 'תיאטרון 7-9' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                  🎭 גילאי 7-9
                </button>
                <button type="button" onClick={() => setSiblingClass('תיאטרון 10-14')}
                  className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${siblingClass === 'תיאטרון 10-14' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                  🎭 גילאי 10-14
                </button>
              </div>
            </div>
            <Button className="w-full" onClick={handleAddSibling} disabled={addingSibling}>
              {addingSibling ? 'שומר...' : 'הוסף אח/אחות'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment proof viewer dialog */}
      <Dialog open={!!viewingProofUrl} onOpenChange={(open) => { if (!open) setViewingProofUrl(null); }}>
        <DialogContent className="max-w-md p-2" dir="rtl">
          {viewingProofUrl && (
            <img
              src={viewingProofUrl}
              alt="אישור תשלום"
              className="w-full max-h-[70vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
