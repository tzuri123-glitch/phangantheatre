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
    <div className="sticky top-0 z-10 bg-card shadow-md">
      <div className="flex justify-center gap-2 p-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
