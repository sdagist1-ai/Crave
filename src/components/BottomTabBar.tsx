import { Icon } from "@iconify/react";
import { TabId } from "../types";

export function BottomTabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const tabs: { id: TabId; label: string; icon: string; activeIcon?: string }[] = [
    { id: "list", label: "List", icon: "solar:hamburger-menu-linear", activeIcon: "solar:hamburger-menu-bold" },
    { id: "calendar", label: "Passport", icon: "solar:global-linear", activeIcon: "solar:global-bold" },
    { id: "spin", label: "Spin", icon: "mdi:dice-5-outline", activeIcon: "mdi:dice-5" },
    { id: "profile", label: "Profile", icon: "solar:user-linear", activeIcon: "solar:user-bold" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/50 pb-safe">
      <div className="flex items-center justify-around h-20 px-6">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const displayIcon = isActive ? (tab.activeIcon || tab.icon) : tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex flex-col items-center gap-1.5 transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon icon={displayIcon} width={24} height={24} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
