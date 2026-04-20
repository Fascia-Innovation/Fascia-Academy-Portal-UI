/**
 * Settings page — merges User Management + View As into a single admin page.
 * Tabs: Users (default), General
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useDashAuth } from "@/contexts/DashAuthContext";
import { toast } from "sonner";
import {
  Loader2, Plus, Pencil, UserCheck, UserX, Eye, ArrowLeftCircle,
  Settings, Users as UsersIcon, Search, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type UserForm = {
  email: string;
  password: string;
  name: string;
  role: "admin" | "course_leader" | "affiliate";
  ghlContactId: string;
  affiliateCode: string;
  profileUrl: string;
  invoiceReference: string;
  isAffiliate: boolean;
  canExamineExams: boolean;
  ghlUserId: string;
};

const EMPTY_FORM: UserForm = {
  email: "", password: "", name: "", role: "course_leader",
  ghlContactId: "", affiliateCode: "", profileUrl: "",
  invoiceReference: "", isAffiliate: false, canExamineExams: false, ghlUserId: "",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator", course_leader: "Course Leader", affiliate: "Affiliate",
};
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  course_leader: "bg-blue-100 text-blue-700",
  affiliate: "bg-amber-100 text-amber-700",
  default: "bg-gray-100 text-gray-700",
};

type Tab = "users" | "general";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("users");
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<NonNullable<typeof users>[number] | null>(null);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { isImpersonating, refetch, user: currentUser } = useDashAuth();

  const { data: users, isLoading } = trpc.admin.listUsers.useQuery();

  const createMutation = trpc.admin.createUser.useMutation({
    onSuccess: () => { toast.success("User created"); setShowCreate(false); setForm(EMPTY_FORM); utils.admin.listUsers.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.admin.updateUser.useMutation({
    onSuccess: () => { toast.success("User updated"); setEditId(null); utils.admin.listUsers.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const impersonateMutation = trpc.admin.impersonate.useMutation({
    onSuccess: (data) => {
      toast.success(`Viewing as ${data.impersonating.name}`);
      utils.dashboard.me.invalidate();
      utils.admin.checkImpersonation.invalidate();
      refetch();
      if (data.impersonating.role === "course_leader") setLocation("/my-overview");
      else if (data.impersonating.role === "affiliate") setLocation("/my-commissions");
      else setLocation("/");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: (data) => {
      toast.success("User deleted");
      setDeleteConfirmUser(null);
      utils.admin.listUsers.invalidate();
      if (data.selfDeleted) {
        // Admin deleted themselves — log out
        utils.dashboard.me.invalidate();
        refetch();
        setLocation("/login");
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
      setLocation("/settings");
    },
    onError: (e) => toast.error(e.message),
  });

  const openEdit = (user: NonNullable<typeof users>[number]) => {
    setForm({
      email: user.email, password: "", name: user.name, role: user.role,
      ghlContactId: user.ghlContactId ?? "",
      affiliateCode: user.affiliateCode ?? "",
      profileUrl: (user as any).profileUrl ?? "",
      invoiceReference: (user as any).invoiceReference ?? "",
      isAffiliate: (user as any).isAffiliate ?? false,
      canExamineExams: (user as any).canExamineExams ?? false,
      ghlUserId: (user as any).ghlUserId ?? "",
    });
    setEditId(user.id);
  };

  const handleSubmit = () => {
    if (!form.email || !form.name || !form.role) { toast.error("Email, name, and role are required"); return; }
    if (editId) {
      updateMutation.mutate({
        id: editId, email: form.email, name: form.name, role: form.role,
        ghlContactId: form.ghlContactId || undefined,
        affiliateCode: form.affiliateCode || undefined,
        profileUrl: form.profileUrl || undefined,
        invoiceReference: form.invoiceReference || undefined,
        isAffiliate: form.isAffiliate, canExamineExams: form.canExamineExams,
        ghlUserId: form.ghlUserId || undefined,
        ...(form.password ? { password: form.password } : {}),
      });
    } else {
      if (!form.password) { toast.error("Password is required"); return; }
      createMutation.mutate({
        email: form.email, password: form.password, name: form.name, role: form.role,
        ghlContactId: form.ghlContactId || undefined,
        affiliateCode: form.affiliateCode || undefined,
        profileUrl: form.profileUrl || undefined,
        invoiceReference: form.invoiceReference || undefined,
        isAffiliate: form.isAffiliate, canExamineExams: form.canExamineExams,
        ghlUserId: form.ghlUserId || undefined,
      });
    }
  };

  const toggleActive = (user: NonNullable<typeof users>[number]) => {
    updateMutation.mutate({ id: user.id, active: !user.active });
  };

  // Filter users by search
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!searchQuery) return users;
    const q = searchQuery.toLowerCase();
    return users.filter((u) =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.role ?? "").toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const activeUsers = filteredUsers.filter((u) => u.active);
  const inactiveUsers = filteredUsers.filter((u) => !u.active);

  const TableHeaders = () => (
    <thead className="bg-muted/50">
      <tr>
        <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">Name</th>
        <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">Email</th>
        <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">Role</th>
        <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">Ref</th>
        <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-left">Status</th>
        <th className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 text-right">Actions</th>
      </tr>
    </thead>
  );

  const renderRow = (user: NonNullable<typeof users>[number]) => (
    <tr key={user.id} className="border-t border-border hover:bg-muted/20 transition-colors">
      <td className="py-3 px-4 text-sm font-medium text-foreground">{user.name}</td>
      <td className="py-3 px-4 text-sm text-muted-foreground">{user.email}</td>
      <td className="py-3 px-4">
        <div className="flex flex-wrap gap-1">
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] ?? ROLE_COLORS.default}`}>
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
          {(user as any).isAffiliate && (
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">+ Affiliate</span>
          )}
          {(user as any).canExamineExams && (
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-teal-100 text-teal-700">+ Examiner</span>
          )}
        </div>
      </td>
      <td className="py-3 px-4 text-xs font-mono text-muted-foreground">{(user as any).invoiceReference || user.affiliateCode || "—"}</td>
      <td className="py-3 px-4">
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${user.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {user.active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-1">
          {user.role !== "admin" && (
            <Button
              variant="ghost" size="sm"
              className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={() => impersonateMutation.mutate({ userId: user.id })}
              disabled={impersonateMutation.isPending}
              title={`View dashboard as ${user.name}`}
            >
              {impersonateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
              View as
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(user)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(user)} title={user.active ? "Deactivate" : "Activate"}>
            {user.active ? <UserX className="h-3.5 w-3.5 text-red-500" /> : <UserCheck className="h-3.5 w-3.5 text-green-500" />}
          </Button>
          <Button
            variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-50"
            onClick={() => setDeleteConfirmUser(user)}
            title="Delete user permanently"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
          </Button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Impersonation banner */}
      {isImpersonating && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Eye className="h-4 w-4" />
            You are currently viewing the dashboard as another user.
          </div>
          <Button
            size="sm" variant="outline"
            className="border-amber-400 text-amber-800 hover:bg-amber-100"
            onClick={() => stopImpersonationMutation.mutate()}
            disabled={stopImpersonationMutation.isPending}
          >
            {stopImpersonationMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ArrowLeftCircle className="h-3.5 w-3.5 mr-1" />}
            Return to Admin View
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage users, roles, and portal configuration</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setTab("users")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "users" ? "border-[oklch(0.22_0.04_255)] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <UsersIcon className="h-4 w-4" /> Users
        </button>
        <button
          onClick={() => setTab("general")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "general" ? "border-[oklch(0.22_0.04_255)] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings className="h-4 w-4" /> General
        </button>
      </div>

      {/* Users tab */}
      {tab === "users" && (
        <div className="space-y-6">
          {/* Search + Add */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => { setForm(EMPTY_FORM); setShowCreate(true); }}
              className="bg-[oklch(0.22_0.04_255)] hover:bg-[oklch(0.28_0.05_255)] text-white"
            >
              <Plus className="h-4 w-4 mr-2" /> Add User
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-8">
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active Users ({activeUsers.length})</h2>
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full"><TableHeaders /><tbody>{activeUsers.map(renderRow)}</tbody></table>
                  </div>
                </div>
              </div>
              {inactiveUsers.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Inactive Users ({inactiveUsers.length})</h2>
                  <div className="bg-card rounded-xl border border-border overflow-hidden opacity-60">
                    <div className="overflow-x-auto">
                      <table className="w-full"><TableHeaders /><tbody>{inactiveUsers.map(renderRow)}</tbody></table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* General tab */}
      {tab === "general" && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6 max-w-lg">
            <h3 className="text-sm font-semibold text-foreground mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
              Portal Information
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Portal URL</span>
                <a href="https://fascidash-9qucsw5g.manus.space" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  fascidash-9qucsw5g.manus.space
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Public Booking (SE)</span>
                <a href="/courses?lang=sv" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  /courses?lang=sv
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Public Booking (EN)</span>
                <a href="/courses?lang=en" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  /courses?lang=en
                </a>
              </div>
            </div>
          </div>

          <div className="bg-muted/30 rounded-xl border border-border p-6 max-w-lg">
            <p className="text-sm text-muted-foreground">
              Additional settings (notification preferences, branding, etc.) will be available here in future updates.
            </p>
          </div>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={showCreate || editId !== null} onOpenChange={(open) => { if (!open) { setShowCreate(false); setEditId(null); } }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
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
                  <Label>GHL User ID (required for calendar matching)</Label>
                  <Input value={form.ghlUserId} onChange={(e) => setForm({ ...form, ghlUserId: e.target.value })} placeholder="e.g. abc123xyz" />
                  <p className="text-xs text-muted-foreground">
                    The GHL user ID for this course leader. Find it in GHL → Settings → Team Members → click the user → copy the ID from the URL. This is used to match their booking calendars.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>GHL Contact ID (optional)</Label>
                  <Input value={form.ghlContactId} onChange={(e) => setForm({ ...form, ghlContactId: e.target.value })} placeholder="e.g. abc123xyz" />
                  <p className="text-xs text-muted-foreground">
                    GHL contact ID for scoped data access (commissions, etc.).
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Profile URL (optional)</Label>
                  <Input type="url" value={form.profileUrl} onChange={(e) => setForm({ ...form, profileUrl: e.target.value })} placeholder="https://fasciaacademy.com/kursledare/anna-lindgren" />
                  <p className="text-xs text-muted-foreground">Link to the course leader's profile page on fasciaacademy.com.</p>
                </div>
              </>
            )}
            {(form.role === "course_leader" || form.role === "affiliate") && (
              <div className="space-y-1.5">
                <Label>Invoice Reference (optional)</Label>
                <Input value={form.invoiceReference} onChange={(e) => setForm({ ...form, invoiceReference: e.target.value })} placeholder="e.g. FK-001" />
                <p className="text-xs text-muted-foreground">Unique payment reference shown on settlements.</p>
              </div>
            )}
            {form.role === "course_leader" && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Also an Affiliate</Label>
                  <p className="text-xs text-muted-foreground">Enable if this course leader also earns affiliate commissions.</p>
                </div>
                <Switch checked={form.isAffiliate} onCheckedChange={(checked) => setForm({ ...form, isAffiliate: checked })} />
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Can Grade Exams</Label>
                <p className="text-xs text-muted-foreground">Grants access to Exam Queue and Certificates.</p>
              </div>
              <Switch checked={form.canExamineExams} onCheckedChange={(checked) => setForm({ ...form, canExamineExams: checked })} />
            </div>
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

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmUser} onOpenChange={(open) => { if (!open) setDeleteConfirmUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete <strong>{deleteConfirmUser?.name}</strong>? This action cannot be undone.
              {deleteConfirmUser?.id === currentUser?.id && (
                <span className="block mt-2 text-amber-600 font-medium">
                  ⚠️ You are deleting your own account. You will be logged out immediately.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmUser(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmUser && deleteMutation.mutate({ id: deleteConfirmUser.id })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
