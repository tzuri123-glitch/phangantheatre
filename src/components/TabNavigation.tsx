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
    <div className="sticky top-[73px] z-40 bg-card/95 backdrop-blur-md shadow-lg border-b border-border/50">
      <div className="flex justify-center gap-2 sm:gap-3 p-2 sm:p-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
              activeTab === tab.id
                ? 'bg-gradient-to-l from-magenta to-magenta-hover text-white shadow-xl scale-105 glow-magenta'
                : 'bg-secondary text-secondary-foreground hover:bg-accent hover:scale-105 hover:shadow-md'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
