import { useRef, useState, useEffect } from "react";
import { LayoutDashboard, Layers, Server, AlertTriangle, Bell, FileText, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useTranslation } from "react-i18next";
import { useLangPrefix } from "@/hooks/use-lang-prefix";
import { useRealtimeAlerts } from "@/hooks/use-realtime-alerts";
import duckLogo from "@/assets/moniduck-logo.png";
import { Separator } from "@/components/ui/separator";

export default function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const lp = useLangPrefix();
  const { unreadCount } = useRealtimeAlerts();
  const hasMounted = useRef(false);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    setSpinning(true);
    const timer = setTimeout(() => setSpinning(false), 400);
    return () => clearTimeout(timer);
  }, [collapsed]);

  const mainItems = [
    { title: "Vue d'ensemble", url: `${lp}/dashboard`, icon: LayoutDashboard },
    { title: "Ma Stack", url: `${lp}/stack`, icon: Layers, highlight: true },
    { title: "Mes Services", url: `${lp}/services`, icon: Server },
    { title: "Incidents", url: `${lp}/incidents`, icon: AlertTriangle },
    { title: "Alertes", url: `${lp}/alerts`, icon: Bell, badge: unreadCount },
    { title: "Rapports", url: `${lp}/reports`, icon: FileText },
  ];

  const bottomItems = [
    { title: "Paramètres", url: `${lp}/settings`, icon: Settings },
  ];

  const renderNavItem = (item: typeof mainItems[0] & { badge?: number; highlight?: boolean }) => (
    <NavLink
      key={item.url}
      to={item.url}
      end={item.url === `${lp}/dashboard`}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-[13px] font-medium relative ${
        item.highlight ? 'text-foreground' : ''
      }`}
      activeClassName="bg-accent text-foreground font-semibold"
    >
      <item.icon className={`w-4 h-4 flex-shrink-0 ${item.highlight ? 'text-primary' : ''}`} />
      {!collapsed && <span>{item.title}</span>}
      {'badge' in item && item.badge !== undefined && item.badge > 0 && (
        <span className={`absolute ${collapsed ? 'top-1 right-1' : 'right-3'} min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1`}>
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
    </NavLink>
  );

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border z-30 transition-all duration-300 flex flex-col ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className="items-center gap-2 p-4 border-b border-sidebar-border min-h-[60px] flex flex-col overflow-hidden">
        <img
          src={duckLogo}
          alt="moniduck"
          className={`flex-shrink-0 object-contain transition-all duration-300 ease-in-out ${
            spinning ? 'animate-[spin_0.4s_ease-in-out]' : ''
          } ${collapsed ? 'w-9 h-9' : 'w-20 h-20'}`}
        />
        <span className={`text-lg font-semibold text-foreground transition-all duration-300 tracking-tight ${collapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
          moniduck
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        <div className="space-y-0.5">
          {mainItems.map(renderNavItem)}
        </div>

        <Separator className="my-3 bg-sidebar-border" />

        <div className="space-y-0.5">
          {bottomItems.map(renderNavItem)}
        </div>
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="p-3 border-t border-sidebar-border text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2 text-xs"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <>
            <ChevronLeft className="w-4 h-4" />
            <span>{t("sidebar.collapse")}</span>
          </>
        )}
      </button>
    </aside>
  );
}
