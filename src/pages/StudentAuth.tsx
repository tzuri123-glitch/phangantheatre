import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/logo.png';

interface ExistingStudent {
  id: string;
  name: string;
  last_name: string | null;
}

export default function StudentAuth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Registration fields
  const [parentName, setParentName] = useState('');
  const [parentLastName, setParentLastName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [studentName, setStudentName] = useState('');
  const [isSibling, setIsSibling] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [siblingId, setSiblingId] = useState('');
  const [existingStudents, setExistingStudents] = useState<ExistingStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (isSibling) {
      const loadStudents = async () => {
        const { data, error } = await supabase.functions.invoke('list-siblings');
        if (!error && data?.students) setExistingStudents(data.students);
      };
      loadStudents();
    }
  }, [isSibling]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        // Password validation
        if (password.length < 8) {
          throw new Error('הסיסמה חייבת להכיל לפחות 8 תווים');
        }
        if (!/[A-Z]/.test(password)) {
          throw new Error('הסיסמה חייבת להכיל לפחות אות גדולה אחת באנגלית');
        }
        if (!/[0-9]/.test(password)) {
          throw new Error('הסיסמה חייבת להכיל לפחות מספר אחד');
        }
        if (password !== confirmPassword) {
          throw new Error('הסיסמאות אינן תואמות');
        }

        // Validate registration fields
        if (!parentName.trim() || !parentLastName.trim() || !parentPhone.trim()) {
          throw new Error('יש למלא את כל פרטי ההורה');
        }
        if (!studentName.trim()) {
          throw new Error('יש למלא את שם התלמיד');
        }
        if (!selectedClass) {
          throw new Error('יש לבחור קבוצה');
        }
        if (!acceptedTerms) {
          throw new Error('יש לאשר את התקנון ומדיניות הפרטיות');
        }

        // 1. Sign up (student record will be created after email confirmation + login)
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: parentName + ' ' + parentLastName,
            },
          },
        });
        if (signUpError) throw signUpError;

        const session = signUpData.session;
        if (!session) {
          // Email confirmation required
          toast({ title: 'נשלח אליך אימייל לאימות. לאחר האימות, התחבר והשלם את ההרשמה.' });
          setIsSignUp(false);
          return;
        }

        // If auto-confirm is on, create student record immediately
        const { data: result, error: fnError } = await supabase.functions.invoke('register-student', {
          body: {
            studentName: studentName.trim(),
            parentName: parentName.trim(),
            parentLastName: parentLastName.trim(),
            parentPhone: parentPhone.trim(),
            siblingId: isSibling && siblingId ? siblingId : null,
            className: selectedClass,
          },
        });

        if (fnError) throw fnError;
        if (result?.error) throw new Error(result.error);

        toast({ title: 'נרשמת בהצלחה! מעביר אותך לאזור האישי...' });
        navigate('/');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast({ title: 'התחברת בהצלחה!' });
        navigate('/');
      }
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent/10 to-background p-4" dir="rtl">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="לוגו" className="h-24 mb-4" />
          <h1 className="text-3xl font-bold text-center text-foreground">
            {isSignUp ? 'הרשמה' : 'כניסה לתלמידים'}
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            {isSignUp ? 'מלא את הפרטים להרשמה למערכת' : 'התחבר לאזור האישי שלך'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">אימייל</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="example@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">סיסמה</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="הכנס סיסמה"
                className="pl-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {isSignUp && (
              <p className="text-xs text-muted-foreground mt-1">
                הסיסמה חייבת להכיל לפחות 8 תווים, אות גדולה אחת באנגלית ומספר אחד
              </p>
            )}
          </div>

          {isSignUp && (
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">אישור סיסמה</label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
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
          )}

          {isSignUp && (
            <>
              <div className="border-t border-border pt-4 mt-4">
                <h3 className="text-sm font-bold text-foreground mb-3">👨‍👩‍👧 פרטי הורה</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1 text-foreground">שם פרטי *</label>
                    <Input
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      required
                      placeholder="שם ההורה"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-foreground">שם משפחה *</label>
                    <Input
                      value={parentLastName}
                      onChange={(e) => setParentLastName(e.target.value)}
                      required
                      placeholder="שם משפחה"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium mb-1 text-foreground">טלפון *</label>
                  <Input
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    required
                    placeholder="050-1234567"
                  />
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-bold text-foreground mb-3">🎭 פרטי התלמיד</h3>
                <div>
                  <label className="block text-xs font-medium mb-1 text-foreground">שם התלמיד *</label>
                  <Input
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    required
                    placeholder="שם התלמיד"
                  />
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-medium mb-2 text-foreground">בחר קבוצה *</label>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setSelectedClass('תיאטרון 7-9')}
                      className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${selectedClass === 'תיאטרון 7-9' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                      🎭 גילאי 7-9
                    </button>
                    <button type="button" onClick={() => setSelectedClass('תיאטרון 10-14')}
                      className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${selectedClass === 'תיאטרון 10-14' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                      🎭 גילאי 10-14
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <Checkbox
                    id="isSibling"
                    checked={isSibling}
                    onCheckedChange={(checked) => {
                      setIsSibling(checked === true);
                      if (!checked) setSiblingId('');
                    }}
                  />
                  <label htmlFor="isSibling" className="text-sm text-foreground cursor-pointer">
                    אח/אחות של תלמיד קיים במערכת
                  </label>
                </div>

                {isSibling && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium mb-1 text-foreground">בחר את האח/אחות</label>
                    <Select value={siblingId} onValueChange={setSiblingId}>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר תלמיד קיים" />
                      </SelectTrigger>
                      <SelectContent>
                        {existingStudents.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} {s.last_name || ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </>
          )}

          {isSignUp && (
            <div className="flex items-start gap-2 mt-2">
              <Checkbox
                id="acceptTerms"
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                className="mt-0.5"
              />
              <label htmlFor="acceptTerms" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                קראתי ואני מסכים/ה ל<a href="/terms" target="_blank" className="text-primary hover:underline">תקנון ותנאי השימוש</a> ול<a href="/privacy" target="_blank" className="text-primary hover:underline">מדיניות הפרטיות</a>
              </label>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading || (isSignUp && !acceptedTerms)}>
            {loading ? 'טוען...' : isSignUp ? 'הירשם' : 'התחבר'}
          </Button>
        </form>

        <div className="mt-4 text-center space-y-2">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-primary hover:underline"
          >
            {isSignUp ? 'כבר יש לך חשבון? התחבר' : 'אין לך חשבון? הירשם'}
          </button>
          {!isSignUp && (
            <div>
              <button
                type="button"
                onClick={() => navigate('/reset-password')}
                className="text-sm text-muted-foreground hover:underline"
              >
                שכחתי סיסמה
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-border text-center space-y-2">
          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="text-xs text-muted-foreground hover:underline"
          >
            כניסת מנהלים
          </button>
          <div className="flex justify-center gap-4">
            <a href="/terms" className="text-xs text-muted-foreground hover:underline">תקנון</a>
            <a href="/privacy" className="text-xs text-muted-foreground hover:underline">מדיניות פרטיות</a>
          </div>
        </div>
      </Card>
    </div>
  );
}
