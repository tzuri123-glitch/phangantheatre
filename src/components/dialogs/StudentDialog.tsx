import { useState, useEffect } from 'react';
import { Student, CLASS_OPTIONS } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: Student;
  students: Student[];
  onSave: (student: Omit<Student, 'id'> & { id?: string }) => void;
}

export default function StudentDialog({ open, onOpenChange, student, students, onSave }: StudentDialogProps) {
  const [formData, setFormData] = useState<{
    name: string;
    lastName: string;
    phone: string;
    birthDate: string;
    parentName: string;
    parentPhone: string;
    isSibling: boolean;
    siblingId: string;
    className: string;
    status: 'חדש' | 'פעיל' | 'בהקפאה' | 'לא פעיל';
  }>({
    name: '',
    lastName: '',
    phone: '',
    birthDate: '',
    parentName: '',
    parentPhone: '',
    isSibling: false,
    siblingId: '',
    className: CLASS_OPTIONS[0],
    status: 'חדש',
  });

  useEffect(() => {
    if (student) {
      setFormData({
        name: student.name,
        lastName: student.lastName,
        phone: student.phone,
        birthDate: student.birthDate,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
        isSibling: student.isSibling,
        siblingId: student.siblingId || '',
        className: student.className as any,
        status: student.status,
      });
    } else {
      setFormData({
        name: '',
        lastName: '',
        phone: '',
        birthDate: '',
        parentName: '',
        parentPhone: '',
        isSibling: false,
        siblingId: '',
        className: CLASS_OPTIONS[0],
        status: 'חדש',
      });
    }
  }, [student, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(student ? { ...formData, id: student.id } : formData);
  };

  const siblings = students.filter((s) => s.id !== student?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{student ? 'ערוך תלמיד' : 'הוסף תלמיד'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>שם פרטי *</Label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label>שם משפחה *</Label>
              <Input
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>טלפון</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>תאריך לידה</Label>
              <Input
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>שם הורה</Label>
              <Input
                value={formData.parentName}
                onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
              />
            </div>
            <div>
              <Label>טלפון הורה</Label>
              <Input
                value={formData.parentPhone}
                onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>חוג *</Label>
              <Select value={formData.className} onValueChange={(v) => setFormData({ ...formData, className: v as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLASS_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>סטטוס *</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="חדש">חדש</SelectItem>
                  <SelectItem value="פעיל">פעיל</SelectItem>
                  <SelectItem value="בהקפאה">בהקפאה</SelectItem>
                  <SelectItem value="לא פעיל">לא פעיל</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isSibling"
              checked={formData.isSibling}
              onChange={(e) => setFormData({ ...formData, isSibling: e.target.checked })}
              className="h-4 w-4"
            />
            <Label htmlFor="isSibling">אח/אחות (מחיר מופחת)</Label>
          </div>

          {formData.isSibling && (
            <div>
              <Label>קשר לאח/אחות</Label>
              <Select value={formData.siblingId} onValueChange={(v) => setFormData({ ...formData, siblingId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר אח/אחות" />
                </SelectTrigger>
                <SelectContent>
                  {siblings.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit">שמור</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
