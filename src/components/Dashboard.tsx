import { useEffect, useRef } from 'react';
import { Student, Payment } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Chart from 'chart.js/auto';
import { formatILS } from '@/lib/utils';

interface DashboardProps {
  students: Student[];
  payments: Payment[];
  onAddStudent: () => void;
}

export default function Dashboard({ students, payments, onAddStudent }: DashboardProps) {
  const barChartRef = useRef<HTMLCanvasElement>(null);
  const weeklyChartRef = useRef<HTMLCanvasElement>(null);
  const pieChartRef = useRef<HTMLCanvasElement>(null);
  const barChartInstance = useRef<Chart | null>(null);
  const weeklyChartInstance = useRef<Chart | null>(null);
  const pieChartInstance = useRef<Chart | null>(null);

  const totalIncome = payments.reduce((sum, p) => sum + p.amount, 0);

  const incomeByMonth = payments.reduce((acc, p) => {
    const monthKey = p.date.slice(0, 7);
    acc[monthKey] = (acc[monthKey] || 0) + p.amount;
    return acc;
  }, {} as Record<string, number>);

  // חישוב הכנסות שבועיות
  const getWeekStart = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(date.setDate(diff));
    return monday.toISOString().slice(0, 10);
  };

  const incomeByWeek = payments.reduce((acc, p) => {
    const weekStart = getWeekStart(p.date);
    acc[weekStart] = (acc[weekStart] || 0) + p.amount;
    return acc;
  }, {} as Record<string, number>);

  const formatWeekLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  };

  const incomeByType = payments.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + p.amount;
    return acc;
  }, {} as Record<string, number>);

  useEffect(() => {
    if (!barChartRef.current || !weeklyChartRef.current || !pieChartRef.current) return;

    // Destroy previous charts
    if (barChartInstance.current) {
      barChartInstance.current.destroy();
    }
    if (weeklyChartInstance.current) {
      weeklyChartInstance.current.destroy();
    }
    if (pieChartInstance.current) {
      pieChartInstance.current.destroy();
    }

    // Bar chart - monthly income
    const barLabels = Object.keys(incomeByMonth).sort();
    const barData = barLabels.map((k) => incomeByMonth[k]);

    barChartInstance.current = new Chart(barChartRef.current, {
      type: 'bar',
      data: {
        labels: barLabels,
        datasets: [
          {
            label: 'הכנסות חודשיות',
            data: barData,
            backgroundColor: 'hsl(188 91% 36%)',
            borderRadius: 8,
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: false },
        },
        responsive: true,
        maintainAspectRatio: true,
      },
    });

    // Weekly chart - weekly income
    const weeklyLabels = Object.keys(incomeByWeek).sort().slice(-8); // Last 8 weeks
    const weeklyDisplayLabels = weeklyLabels.map(formatWeekLabel);
    const weeklyData = weeklyLabels.map((k) => incomeByWeek[k]);

    weeklyChartInstance.current = new Chart(weeklyChartRef.current, {
      type: 'line',
      data: {
        labels: weeklyDisplayLabels,
        datasets: [
          {
            label: 'הכנסות שבועיות',
            data: weeklyData,
            backgroundColor: 'hsl(142 71% 45% / 0.2)',
            borderColor: 'hsl(142 71% 45%)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: false },
        },
        responsive: true,
        maintainAspectRatio: true,
      },
    });

    // Pie chart - income by type
    const pieLabels = Object.keys(incomeByType);
    const pieData = pieLabels.map((k) => incomeByType[k]);
    const colors = [
      'hsl(188 91% 36%)',
      'hsl(188 91% 50%)',
      'hsl(142 71% 45%)',
      'hsl(48 96% 53%)',
      'hsl(0 84% 60%)',
    ];

    pieChartInstance.current = new Chart(pieChartRef.current, {
      type: 'pie',
      data: {
        labels: pieLabels,
        datasets: [
          {
            data: pieData,
            backgroundColor: colors.slice(0, pieLabels.length),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
      },
    });

    return () => {
      if (barChartInstance.current) {
        barChartInstance.current.destroy();
      }
      if (weeklyChartInstance.current) {
        weeklyChartInstance.current.destroy();
      }
      if (pieChartInstance.current) {
        pieChartInstance.current.destroy();
      }
    };
  }, [payments]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-foreground">ברוך הבא למערכת ניהול החוג! 🎭</h2>
        <button
          onClick={onAddStudent}
          className="px-6 py-3 rounded-lg font-bold text-base shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-105"
          style={{ backgroundColor: 'hsl(var(--pink))', color: 'white' }}
        >
          ➕ הוסף תלמיד
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">סה"כ תלמידים</h3>
          <p className="text-4xl font-bold text-primary">{students.length}</p>
        </Card>
        
        <Card className="p-6 bg-gradient-to-br from-accent to-accent/50 border-primary/20">
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">סה"כ הכנסות</h3>
          <p className="text-4xl font-bold text-primary">{formatILS(totalIncome)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4 text-foreground">הכנסות חודשיות</h3>
          <canvas ref={barChartRef}></canvas>
        </Card>

        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4 text-foreground">הכנסות שבועיות</h3>
          <canvas ref={weeklyChartRef}></canvas>
        </Card>

        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4 text-foreground">הכנסות לפי סוג</h3>
          <canvas ref={pieChartRef}></canvas>
        </Card>
      </div>
    </div>
  );
}
