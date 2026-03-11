import { Book, BarChart3, Server, Cloud, Globe, Bell, FileText, Settings, LayoutDashboard, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const sections = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    description:
      'Your central control panel. Add customizable widgets (uptime charts, alert counters, status lists…) and arrange them freely via drag & drop. Use templates to get started fast, or build your own layout. TV Mode lets you display your dashboard on a shared screen for the whole team.',
  },
  {
    icon: Server,
    title: 'Services',
    description:
      'Monitor any HTTP endpoint. Add a URL, choose a check interval (1–10 min), and MoniDuck will ping it regularly. You get uptime percentage, average response time, SSL certificate info, and instant alerts when a service goes down. Set visibility to "public" to include it in shared reports.',
  },
  {
    icon: Cloud,
    title: 'Cloud',
    description:
      'Connect your AWS account (GCP & Azure coming soon) to auto-discover running resources. Track costs by service and by resource, view daily spending trends, and get alerts when costs spike unexpectedly.',
  },
  {
    icon: Globe,
    title: 'SaaS',
    description:
      'Track the availability of third-party SaaS tools your team depends on (Slack, GitHub, Stripe…). MoniDuck checks their status pages and measures response times so you know immediately when a dependency is degraded.',
  },
  {
    icon: BarChart3,
    title: 'Integrations',
    description:
      'Connect services like Google Workspace or Microsoft 365 via OAuth. MoniDuck syncs usage data (Drive storage, license counts, email stats) and displays them as widgets on your dashboard.',
  },
  {
    icon: Bell,
    title: 'Alerts',
    description:
      'All alerts in one place. Filter by severity (critical, warning, info), by service, or by date. Configure per-service thresholds and choose to be notified by email when a service goes down or comes back up. Built-in anti-spam prevents duplicate notifications.',
  },
  {
    icon: FileText,
    title: 'Reports',
    description:
      'Generate uptime & SLA reports for any period. Export them as PDF or share a public link with stakeholders. Reports include uptime %, incident history, and average response times for selected services.',
  },
  {
    icon: Settings,
    title: 'Settings',
    description:
      'Manage your workspace name, invite team members, and configure integrations. Admins can assign roles and control access to the workspace.',
  },
];

export default function DocsDrawer() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground h-8 w-8">
          <Book className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[440px] bg-background border-border p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="text-foreground flex items-center gap-2">
            <Book className="w-4 h-4 text-primary" />
            Documentation
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-5rem)] px-6 py-4">
          <p className="text-sm text-muted-foreground mb-6">
            Quick guide to every section of MoniDuck. Click on a sidebar tab to navigate there.
          </p>
          <div className="space-y-5">
            {sections.map((s) => (
              <div key={s.title} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className="w-4 h-4 text-primary shrink-0" />
                  <h3 className="font-semibold text-sm text-foreground">{s.title}</h3>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{s.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 mb-8 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Need help?</span>{' '}
              Reach out to us at{' '}
              <a href="mailto:support@moniduck.com" className="text-primary hover:underline">
                support@moniduck.com
              </a>
            </p>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
