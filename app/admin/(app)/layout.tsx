import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Badge } from "@/components/ui/badge";
import { DEMO_MODE } from "@/lib/config";

export default function AdminAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <AdminSidebar />
      <div className="md:pl-64">
        {DEMO_MODE && (
          <div className="flex h-9 items-center justify-center gap-2 bg-warning/15 text-xs font-medium text-warning-foreground">
            <Badge variant="warning" className="h-5">DEMO MODE</Badge>
            All data on this dashboard is synthetic. No real customer information is displayed.
          </div>
        )}
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
