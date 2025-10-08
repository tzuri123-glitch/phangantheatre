import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { LogOut } from "lucide-react";
import logo from "@/assets/logo.jpeg";
import Dashboard from "@/components/Dashboard";
import { useState } from 'react';
import { Student, Payment } from '@/types';

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    
    const loadData = async () => {
      const { data: studentsData } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user.id);
      
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id);
      
      if (studentsData) {
        setStudents(studentsData.map(s => ({
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
          status: s.status as Student['status']
        })));
      }
      
      if (paymentsData) {
        setPayments(paymentsData.map(p => ({
          id: p.id,
          studentId: p.student_id,
          type: p.payment_type as Payment['type'],
          method: p.payment_method as Payment['method'],
          date: p.payment_date,
          amount: Number(p.amount),
          note: p.note || '',
          discount: Number(p.discount) || 0
        })));
      }
    };
    
    loadData();
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--background))' }}>
      <div className="shadow-md border-b animate-fade-in" style={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img 
              src={logo} 
              alt="Koh Phangan Music & Performing Arts" 
              className="h-12 w-auto object-contain hover:scale-105 transition-transform duration-300"
            />
            <div className="hidden md:block">
              <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--foreground))' }}>מערכת ניהול נוכחות</h1>
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
      <Dashboard students={students} payments={payments} onAddStudent={() => {}} />
    </div>
  );
};

export default Index;
