interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'dashboard', label: 'דשבורד' },
  { id: 'students', label: 'תלמידים' },
  { id: 'attendance', label: 'נוכחות' },
  { id: 'payments', label: 'תשלומים' },
];

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="sticky top-0 z-10 shadow-lg" style={{ backgroundColor: 'hsl(var(--card))' }}>
      <div className="flex justify-center gap-3 p-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-6 py-3 rounded-xl font-bold text-base transition-all duration-200 ${
              activeTab === tab.id
                ? 'shadow-xl scale-105'
                : 'hover:scale-105 hover:shadow-lg'
            }`}
            style={
              activeTab === tab.id
                ? { backgroundColor: 'hsl(var(--turquoise))', color: 'hsl(var(--foreground))' }
                : { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
