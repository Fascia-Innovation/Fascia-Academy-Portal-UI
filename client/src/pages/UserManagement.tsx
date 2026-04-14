import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useDashAuth } from "@/contexts/DashAuthContext";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, UserCheck, UserX, Eye, ArrowLeftCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type UserForm = {
  email: string;
  password: string;
  name: string;
  role: "admin" | "course_leader" | "affiliate";
  ghlContactId: string;
  affiliateCode: string;
  profileUrl: string; // link to course leader's profile page on fasciaacademy.com
  invoiceReference: string; // unique payment reference for settlements (e.g. "FK-001")
  isAffiliate: boolean; // true = also acts as affiliate (dual-role)
};

const EMPTY_FORM: UserForm = {
  email: "",
  password: "",
  name: "",
  role: "course_leader",
  ghlContactId: "",
  affiliateCode: "",
  profileUrl: "",
  invoiceReference: "",
  isAffiliate: false,
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  course_leader: "Course Leader",
  affiliate: "Affiliate",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  course_leader: "bg-blue-100 text-blue-700",
  affiliate: "bg-amber-100 text-amber-700",
};

export default function UserManagement() {
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { isImpersonating, refetch } = useDashAuth();

  const { data: users, isLoading } = trpc.admin.listUsers.useQuery();

  const createMutation = trpc.admin.createUser.useMutation({
    onSuccess: () => {
      toast.success("User created successfully");
      setShowCreate(false);
      setForm(EMPTY_FORM);
      utils.admin.listUsers.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.admin.updateUser.useMutation({
    onSuccess: () => {
      toast.success("User updated");
      setEditId(null);
      utils.admin.listUsers.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const impersonateMutation = trpc.admin.impersonate.useMutation({
    onSuccess: (data) => {
      toast.success(`Viewing as ${data.impersonating.name}`);
      utils.dashboard.me.invalidate();
      utils.admin.checkImpersonation.invalidate();
      refetch();
      // Navigate to the appropriate home page for the role
      if (data.impersonating.role === "course_leader") {
        setLocation("/my-courses");
      } else if (data.impersonating.role === "affiliate") {
        setLocation("/my-commissions");
      } else {
        setLocation("/");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const stopImpersonationMutation = trpc.admin.stopImpersonation.useMutation({
    onSuccess: () => {
      toast.success("Returned to admin view");
      utils.dashboard.me.invalidate();
      utils.admin.checkImpersonation.invalidate();
      refetch();
      setLocation("/users");
    },
    onError: (e) => toast.error(e.message),
  });

  const openEdit = (user: NonNullable<typeof users>[number]) => {
    setForm({
      email: user.email,
      password: "",
      name: user.name,
      role: user.role,
      ghlContactId: user.ghlContactId ?? "",
      affiliateCode: user.affiliateCode ?? "",
      profileUrl: (user as any).profileUrl ?? "",
      invoiceReference: (user as any).invoiceReference ?? "",
      isAffiliate: (user as any).isAffiliate ?? false,
    });
    setEditId(user.id);
  };

  const handleSubmit = () => {
    if (!form.email || !form.name || !form.role) {
      toast.error("Email, name, and role are required");
      return;
    }
    if (editId) {
      updateMutation.mutate({
        id: editId,
        email: form.email,
        name: form.name,
        role: form.role,
        ghlContactId: form.ghlContactId || undefined,
        affiliateCode: form.affiliateCode || undefined,
        profileUrl: form.profileUrl || undefined,
        invoiceReference: form.invoiceReference || undefined,
        isAffiliate: form.isAffiliate,
        ...(form.password ? { password: form.password } : {}),
      });
    } else {
      if (!form.password) { toast.error("Password is required"); return; }
      createMutation.mutate({
        email: form.email,
        password: form.password,
        name: form.name,
        role: form.role,
        ghlContactId: form.ghlContactId || undefined,
        affiliateCode: form.affiliateCode || undefined,
        profileUrl: form.profileUrl || undefined,
        invoiceReference: form.invoiceReference || undefined,
        isAffiliate: form.isAffiliate,
      });
    }
  };

  const toggleActive = (user: NonNullable<typeof users>[number]) => {
    updateMutation.mutate({ id: user.id, active: !user.active });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Impersonation banner */}
      {isImpersonating && (
        <div className="mb-6 flex items-center justify-between bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Eye className="h-4 w-4" />
            You are currently viewing the dashboard as another user.
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-400 text-amber-800 hover:bg-amber-100"
            onClick={() => stopImpersonationMutation.mutate()}
            disabled={stopImpersonationMutation.isPending}
          >
            {stopImpersonationMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <ArrowLeftCircle className="h-3.5 w-3.5 mr-1" />
            )}
            Return to Admin View
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            User Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage dashboard access for course leaders and affiliates</p>
        </div>
        <Button
          onClick={() => { setForm(EMPTY_FORM); setShowCreate(true); }}
          className="bg-[oklch(0.22_0.04_255)] hover:bg-[oklch(0.28_0.05_255)] text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">Name</th>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">Email</th>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">Role</th>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">GHL Calendar ID</th>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">Affiliate Code</th>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">Status</th>
                  <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((user) => (
                  <tr key={user.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 text-sm font-medium text-foreground">{user.name}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{user.email}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-700"}`}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-muted-foreground">{user.ghlContactId ?? "—"}</td>
                    <td className="py-3 px-4 text-sm font-mono text-muted-foreground">{user.affiliateCode ?? "—"}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${user.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {user.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* View As button — only for non-admin users */}
                        {user.role !== "admin" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => impersonateMutation.mutate({ userId: user.id })}
                            disabled={impersonateMutation.isPending}
                            title={`View dashboard as ${user.name}`}
                          >
                            {impersonateMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Eye className="h-3.5 w-3.5 mr-1" />
                            )}
                            View as
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(user)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => toggleActive(user)}
                          title={user.active ? "Deactivate" : "Activate"}
                        >
                          {user.active ? <UserX className="h-3.5 w-3.5 text-red-500" /> : <UserCheck className="h-3.5 w-3.5 text-green-500" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={showCreate || editId !== null} onOpenChange={(open) => { if (!open) { setShowCreate(false); setEditId(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }}>
              {editId ? "Edit User" : "Add New User"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Anna Lindgren" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="anna@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>{editId ? "New Password (leave blank to keep)" : "Password"}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserForm["role"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="course_leader">Course Leader</SelectItem>
                  <SelectItem value="affiliate">Affiliate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === "course_leader" && (
              <>
                <div className="space-y-1.5">
                  <Label>GHL Calendar ID (optional)</Label>
                  <Input value={form.ghlContactId} onChange={(e) => setForm({ ...form, ghlContactId: e.target.value })} placeholder="Override calendar ID for multi-leader calendars" />
                  <p className="text-xs text-muted-foreground">
                    Leave blank if the calendar name contains the leader's name (e.g. "Intro - Anna Lindgren - Stockholm").
                    Set this for shared calendars like "Fascia Academy Sollentuna".
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Profile URL (optional)</Label>
                  <Input
                    type="url"
                    value={form.profileUrl}
                    onChange={(e) => setForm({ ...form, profileUrl: e.target.value })}
                    placeholder="https://fasciaacademy.com/kursledare/anna-lindgren"
                  />
                  <p className="text-xs text-muted-foreground">
                    Link to the course leader's profile page on fasciaacademy.com. Shown as "Om kursledaren" on the public booking page.
                  </p>
                </div>
              </>
            )}
            {(form.role === "course_leader" || form.role === "affiliate") && (
              <div className="space-y-1.5">
                <Label>Invoice Reference (optional)</Label>
                <Input
                  value={form.invoiceReference}
                  onChange={(e) => setForm({ ...form, invoiceReference: e.target.value })}
                  placeholder="e.g. FK-001 or Victor Forsell"
                />
                <p className="text-xs text-muted-foreground">
                  Unique payment reference shown on settlements. Used to identify the invoice from this person.
                </p>
              </div>
            )}
            {form.role === "course_leader" && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Also an Affiliate</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable if this course leader also earns affiliate commissions. They will see both dashboards.
                  </p>
                </div>
                <Switch
                  checked={form.isAffiliate}
                  onCheckedChange={(checked) => setForm({ ...form, isAffiliate: checked })}
                />
              </div>
            )}
            {(form.role === "affiliate" || (form.role === "course_leader" && form.isAffiliate)) && (
              <div className="space-y-1.5">
                <Label>Affiliate Code</Label>
                <Input value={form.affiliateCode} onChange={(e) => setForm({ ...form, affiliateCode: e.target.value })} placeholder="e.g. VICTOR10" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditId(null); }}>Cancel</Button>
            <Button
              className="bg-[oklch(0.22_0.04_255)] hover:bg-[oklch(0.28_0.05_255)] text-white"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : editId ? "Save Changes" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
