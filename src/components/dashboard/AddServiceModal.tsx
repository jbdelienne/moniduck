import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CheckCircle, Loader2 } from 'lucide-react';
import IconPicker from './IconPicker';
import { useAuth } from '@/contexts/AuthContext';

interface AddServiceModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (service: {
    name: string;
    icon: string;
    url: string;
    check_interval: number;
    content_keyword?: string;
    visibility?: string;
    alert_checks_threshold?: number;
    notification_email?: string;
    alert_notify_down?: boolean;
    alert_notify_up?: boolean;
  }) => Promise<void>;
}

export default function AddServiceModal({ open, onClose, onAdd }: AddServiceModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [url, setUrl] = useState('');
  const [interval, setInterval] = useState('2');
  const [contentKeyword, setContentKeyword] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [checksBeforeAlert, setChecksBeforeAlert] = useState('2');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [alertNotifyDown, setAlertNotifyDown] = useState(true);
  const [alertNotifyUp, setAlertNotifyUp] = useState(true);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onAdd({
        name,
        icon,
        url,
        check_interval: Number(interval),
        content_keyword: contentKeyword || undefined,
        visibility,
        alert_checks_threshold: Number(checksBeforeAlert),
        notification_email: notificationEmail || undefined,
        alert_notify_down: alertNotifyDown,
        alert_notify_up: alertNotifyUp,
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setName('');
        setUrl('');
        setIcon('');
        setInterval('2');
        setContentKeyword('');
        setVisibility('public');
        setChecksBeforeAlert('2');
        setNotificationEmail('');
        setAlertNotifyDown(true);
        setAlertNotifyUp(true);
        setLoading(false);
        onClose();
      }, 1500);
    } catch {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add new service</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center py-8 animate-scale-in">
            <CheckCircle className="w-12 h-12 text-success mb-3" />
            <p className="font-semibold text-foreground">Service added!</p>
            <p className="text-sm text-muted-foreground">Checking status...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="svc-name">Service name</Label>
              <Input id="svc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Stripe API" required />
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <IconPicker value={icon} onChange={setIcon} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="svc-url">URL to monitor</Label>
              <Input id="svc-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/health" required />
            </div>

            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">🌐 Public endpoint</SelectItem>
                  <SelectItem value="private">🔒 Private endpoint</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Public endpoints trigger critical alerts. Private endpoints trigger warnings.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="svc-keyword">Content validation keyword <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input id="svc-keyword" value={contentKeyword} onChange={(e) => setContentKeyword(e.target.value)} placeholder="e.g. OK, healthy, alive" />
              <p className="text-[11px] text-muted-foreground">Service marked degraded when keyword not found in response.</p>
            </div>

            {/* Alert Configuration Section */}
            <div className="border-t border-border pt-4 mt-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Alert Configuration</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Check interval</Label>
                  <Select value={interval} onValueChange={setInterval}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Every minute</SelectItem>
                      <SelectItem value="2">Every 2 minutes (default)</SelectItem>
                      <SelectItem value="5">Every 5 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Alert sensitivity</Label>
                  <Select value={checksBeforeAlert} onValueChange={setChecksBeforeAlert}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 failed check → Immediate</SelectItem>
                      <SelectItem value="2">2 failed checks → Recommended (default)</SelectItem>
                      <SelectItem value="5">5 failed checks → Conservative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="svc-notify-email">Notification email</Label>
                  <Input
                    id="svc-notify-email"
                    type="email"
                    value={notificationEmail}
                    onChange={(e) => setNotificationEmail(e.target.value)}
                    placeholder={user?.email || "your@email.com"}
                  />
                  <p className="text-[11px] text-muted-foreground">Defaults to your account email if left empty.</p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="notify-down" className="cursor-pointer">Alert when down</Label>
                    <p className="text-[11px] text-muted-foreground">Get notified when service goes down</p>
                  </div>
                  <Switch id="notify-down" checked={alertNotifyDown} onCheckedChange={setAlertNotifyDown} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="notify-up" className="cursor-pointer">Alert when recovered</Label>
                    <p className="text-[11px] text-muted-foreground">Get notified when service comes back</p>
                  </div>
                  <Switch id="notify-up" checked={alertNotifyUp} onCheckedChange={setAlertNotifyUp} />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full gradient-primary text-primary-foreground hover:opacity-90 transition-opacity"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Start Monitoring
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
