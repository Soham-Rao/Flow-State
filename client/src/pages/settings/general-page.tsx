import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UserHoverCard } from "@/components/users/user-hover-card";
import { listInvites } from "@/lib/invites-api";
import { createRole, deleteRole, listRoleAssignments, listRoles, updateRole, updateUserRoles } from "@/lib/roles-api";
import { useAuthStore } from "@/stores/auth-store";
import type { InviteSummary } from "@/types/invite";
import { type RolePermission, type RoleSummary, type UserRoleAssignment } from "@/types/roles";

const FONT_STORAGE_KEY = "flowstate:font";
const SPACING_STORAGE_KEY = "flowstate:spacing";
const THEME_STORAGE_KEY = "flowstate:theme";

type FontOption = "grotesk" | "serif" | "plex" | "merriweather";

type ThemeOption = "light" | "dark" | "system";

type SpacingOption = "tight" | "compact" | "default" | "spacious";

type RoleDraft = {
  name: string;
  color: string;
  permissions: RolePermission[];
};

type PermissionItem = {
  permission: RolePermission;
  title: string;
  description: string;
  enabledLabel: string;
  disabledLabel: string;
};

type PermissionGroup = {
  id: string;
  title: string;
  description: string;
  items: PermissionItem[];
};

const fontOptions: Array<{ value: FontOption; label: string; description: string }> = [
  {
    value: "grotesk",
    label: "Space Grotesk",
    description: "Clean geometric sans"
  },
  {
    value: "serif",
    label: "Fraunces",
    description: "Editorial serif"
  },
  {
    value: "plex",
    label: "IBM Plex Sans",
    description: "Professional sans"
  },
  {
    value: "merriweather",
    label: "Merriweather",
    description: "Readable serif"
  }
];

const spacingOptions: Array<{ value: SpacingOption; label: string; description: string }> = [
  {
    value: "tight",
    label: "Tight",
    description: "Dense and compact"
  },
  {
    value: "compact",
    label: "Compact",
    description: "Slightly tighter"
  },
  {
    value: "default",
    label: "Default",
    description: "Balanced spacing"
  },
  {
    value: "spacious",
    label: "Spacious",
    description: "Airy and relaxed"
  }
];

const permissionGroups: PermissionGroup[] = [
  {
    id: "workspace",
    title: "Workspace controls",
    description: "Admin-level actions that impact the entire workspace.",
    items: [
      {
        permission: "manage_workspace",
        title: "Manage workspace",
        description: "Change workspace-wide settings and metadata.",
        enabledLabel: "Can manage workspace settings",
        disabledLabel: "Cannot manage workspace settings"
      },
      {
        permission: "manage_roles",
        title: "Manage roles",
        description: "Create, edit, and assign roles.",
        enabledLabel: "Can manage roles",
        disabledLabel: "Cannot manage roles"
      },
      {
        permission: "invite_users",
        title: "Invite users",
        description: "Send invite links to new teammates.",
        enabledLabel: "Can invite users",
        disabledLabel: "Cannot invite users"
      },
      {
        permission: "remove_users",
        title: "Remove users",
        description: "Remove people from the workspace.",
        enabledLabel: "Can remove users",
        disabledLabel: "Cannot remove users"
      },
      {
        permission: "view_activity_logs",
        title: "View activity logs",
        description: "Audit activity across boards and tasks.",
        enabledLabel: "Can view activity logs",
        disabledLabel: "Cannot view activity logs"
      },
      {
        permission: "view_settings",
        title: "Access settings",
        description: "Open settings pages in the app.",
        enabledLabel: "Can access settings",
        disabledLabel: "Cannot access settings"
      }
    ]
  },
  {
    id: "boards",
    title: "Boards and lists",
    description: "Visibility and structural control over boards and lists.",
    items: [
      {
        permission: "view_boards",
        title: "View boards",
        description: "See boards and their content.",
        enabledLabel: "Can view all boards",
        disabledLabel: "Cannot view boards"
      },
      {
        permission: "create_boards",
        title: "Create boards",
        description: "Start new boards.",
        enabledLabel: "Can create boards",
        disabledLabel: "Cannot create boards"
      },
      {
        permission: "edit_boards",
        title: "Edit boards",
        description: "Rename and update board settings.",
        enabledLabel: "Can edit boards",
        disabledLabel: "Cannot edit boards"
      },
      {
        permission: "delete_boards",
        title: "Delete boards",
        description: "Remove boards entirely.",
        enabledLabel: "Can delete boards",
        disabledLabel: "Cannot delete boards"
      },
      {
        permission: "manage_lists",
        title: "Manage lists",
        description: "Create, rename, or archive lists.",
        enabledLabel: "Can manage lists",
        disabledLabel: "Cannot manage lists"
      }
    ]
  },
  {
    id: "cards",
    title: "Cards and tasks",
    description: "Actions that apply to tasks inside lists.",
    items: [
      {
        permission: "create_cards",
        title: "Create cards",
        description: "Add new tasks to lists.",
        enabledLabel: "Can create cards",
        disabledLabel: "Cannot create cards"
      },
      {
        permission: "edit_cards",
        title: "Edit cards",
        description: "Update card details.",
        enabledLabel: "Can edit cards",
        disabledLabel: "Cannot edit cards"
      },
      {
        permission: "delete_cards_any",
        title: "Delete any card",
        description: "Remove cards created by anyone.",
        enabledLabel: "Can delete any card",
        disabledLabel: "Cannot delete others' cards"
      },
      {
        permission: "delete_cards_own",
        title: "Delete own cards",
        description: "Remove cards you created.",
        enabledLabel: "Can delete own cards",
        disabledLabel: "Cannot delete own cards"
      },
      {
        permission: "assign_members",
        title: "Assign members",
        description: "Assign teammates to cards.",
        enabledLabel: "Can assign members",
        disabledLabel: "Cannot assign members"
      },
      {
        permission: "set_due_dates",
        title: "Set due dates",
        description: "Schedule deadlines on cards.",
        enabledLabel: "Can set due dates",
        disabledLabel: "Cannot set due dates"
      },
      {
        permission: "manage_checklists",
        title: "Manage checklists",
        description: "Add and update checklist items.",
        enabledLabel: "Can manage checklists",
        disabledLabel: "Cannot manage checklists"
      },
      {
        permission: "upload_files",
        title: "Upload files",
        description: "Attach files to cards.",
        enabledLabel: "Can upload files",
        disabledLabel: "Cannot upload files"
      },
      {
        permission: "manage_labels",
        title: "Manage labels",
        description: "Create and edit label sets.",
        enabledLabel: "Can manage labels",
        disabledLabel: "Cannot manage labels"
      }
    ]
  },
  {
    id: "comments",
    title: "Comments and mentions",
    description: "Discussion tools across boards and cards.",
    items: [
      {
        permission: "comment",
        title: "Write comments",
        description: "Post updates in threads and cards.",
        enabledLabel: "Can comment",
        disabledLabel: "Cannot comment"
      },
      {
        permission: "edit_comments",
        title: "Edit comments",
        description: "Update comments after posting.",
        enabledLabel: "Can edit comments",
        disabledLabel: "Cannot edit comments"
      },
      {
        permission: "delete_comments",
        title: "Delete comments",
        description: "Remove comments from discussions.",
        enabledLabel: "Can delete comments",
        disabledLabel: "Cannot delete comments"
      },
      {
        permission: "react",
        title: "React with emojis",
        description: "Add emoji reactions to comments.",
        enabledLabel: "Can react",
        disabledLabel: "Cannot react"
      },
      {
        permission: "mention_users",
        title: "Mention users",
        description: "Use @username mentions.",
        enabledLabel: "Can mention users",
        disabledLabel: "Cannot mention users"
      },
      {
        permission: "mention_roles",
        title: "Mention roles",
        description: "Use @role mentions.",
        enabledLabel: "Can mention roles",
        disabledLabel: "Cannot mention roles"
      }
    ]
  },
    {
    id: "threads",
    title: "Threads",
    description: "Thread visibility and moderation controls.",
    items: [
      {
        permission: "view_threads",
        title: "View threads",
        description: "Open the Threads section.",
        enabledLabel: "Can view threads",
        disabledLabel: "Cannot view threads"
      },
      {
        permission: "create_threads",
        title: "Create threads",
        description: "Start new discussion threads.",
        enabledLabel: "Can create threads",
        disabledLabel: "Cannot create threads"
      },
      {
        permission: "reply_threads",
        title: "Reply in threads",
        description: "Post replies in threads.",
        enabledLabel: "Can reply in threads",
        disabledLabel: "Cannot reply in threads"
      },
      {
        permission: "delete_threads",
        title: "Delete threads",
        description: "Remove entire threads.",
        enabledLabel: "Can delete threads",
        disabledLabel: "Cannot delete threads"
      },
      {
        permission: "pin_threads",
        title: "Pin threads",
        description: "Pin important threads.",
        enabledLabel: "Can pin threads",
        disabledLabel: "Cannot pin threads"
      },
      {
        permission: "dm_read",
        title: "View direct messages",
        description: "Open and read direct message threads.",
        enabledLabel: "Can view direct messages",
        disabledLabel: "Cannot view direct messages"
      },
      {
        permission: "dm_write",
        title: "Send direct messages",
        description: "Send messages in direct message threads.",
        enabledLabel: "Can send direct messages",
        disabledLabel: "Cannot send direct messages"
      },
      {
        permission: "dm_encrypt",
        title: "Encrypt direct messages",
        description: "Allow encrypted storage for direct messages.",
        enabledLabel: "Direct messages are encrypted",
        disabledLabel: "Direct messages are not encrypted"
      },
      {
        permission: "channel_read",
        title: "View channels",
        description: "See channel conversations.",
        enabledLabel: "Can view channels",
        disabledLabel: "Cannot view channels"
      },
      {
        permission: "channel_write",
        title: "Send channel messages",
        description: "Post in channel conversations.",
        enabledLabel: "Can send channel messages",
        disabledLabel: "Cannot send channel messages"
      }
    ]
  }
];

function normalizeStoredFont(value: string | null): FontOption {
  if (value === "dm-sans") return "plex";
  if (value === "playfair") return "merriweather";
  if (value === "plex" || value === "merriweather" || value === "serif" || value === "grotesk") return value;
  return "grotesk";
}

function normalizeStoredTheme(value: string | null): ThemeOption {
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
}

function resolveTheme(value: ThemeOption): "light" | "dark" {
  if (value === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return value;
}

function applyTheme(value: ThemeOption): void {
  document.documentElement.dataset.theme = resolveTheme(value);
}

function applyFont(value: FontOption): void {
  document.documentElement.dataset.font = value;
}

function applySpacing(value: SpacingOption): void {
  document.documentElement.dataset.spacing = value;
}

function normalizeRoleIds(roleIds: string[]): string[] {
  return Array.from(new Set(roleIds)).sort();
}

function normalizePermissions(permissions: RolePermission[]): RolePermission[] {
  return Array.from(new Set(permissions)).sort();
}

function permissionsMatch(a: RolePermission[], b: RolePermission[]): boolean {
  const left = normalizePermissions(a);
  const right = normalizePermissions(b);
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function togglePermission(current: RolePermission[], permission: RolePermission): RolePermission[] {
  if (current.includes(permission)) {
    return current.filter((value) => value !== permission);
  }
  return [...current, permission];
}
function SettingsModal({
  open,
  title,
  description,
  onClose,
  children
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <Card className="w-full max-w-4xl" onMouseDown={(event) => event.stopPropagation()}>
        <CardHeader className="space-y-1">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="max-h-[70vh] space-y-4 overflow-y-auto">
          {children}
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PermissionToggleRow({
  item,
  enabled,
  disabled,
  onToggle
}: {
  item: PermissionItem;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-card/80 p-3 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold">{item.title}</p>
        <p className={`text-xs font-medium ${enabled ? "text-emerald-600" : "text-rose-500"}`}>
          {enabled ? item.enabledLabel : item.disabledLabel}
        </p>
        <p className="text-xs text-muted-foreground">{item.description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={onToggle}
        className={`flex h-6 w-12 items-center rounded-full px-0.5 transition-colors ${
          enabled ? "bg-emerald-500" : "bg-rose-500"
        } ${enabled ? "justify-end" : "justify-start"} ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className="h-5 w-5 rounded-full bg-white transition-transform" />
      </button>
    </div>
  );
}

export function GeneralSettingsPage(): JSX.Element {
  const currentUser = useAuthStore((state) => state.user);
  const canManageRoles = currentUser?.role === "admin";
  const [selectedFont, setSelectedFont] = useState<FontOption>("grotesk");
  const [baselineFont, setBaselineFont] = useState<FontOption>("grotesk");
  const [selectedSpacing, setSelectedSpacing] = useState<SpacingOption>("default");
  const [baselineSpacing, setBaselineSpacing] = useState<SpacingOption>("default");
  const [selectedTheme, setSelectedTheme] = useState<ThemeOption>("system");
  const [baselineTheme, setBaselineTheme] = useState<ThemeOption>("system");
  const [status, setStatus] = useState<"idle" | "saved">("idle");

  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [assignments, setAssignments] = useState<UserRoleAssignment[]>([]);
  const [invites, setInvites] = useState<InviteSummary[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [userRoleDrafts, setUserRoleDrafts] = useState<Record<string, string[]>>({});
  const [savingUsers, setSavingUsers] = useState<Set<string>>(new Set());

  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#64748b");
  const [newRolePermissions, setNewRolePermissions] = useState<RolePermission[]>(["view_boards"]);
  const [creatingRole, setCreatingRole] = useState(false);

  const [roleDrafts, setRoleDrafts] = useState<Record<string, RoleDraft>>({});
  const [savingRoles, setSavingRoles] = useState<Set<string>>(new Set());
  const [deletingRoles, setDeletingRoles] = useState<Set<string>>(new Set());

  const [showCreateRole, setShowCreateRole] = useState(false);
  const [showManageRoles, setShowManageRoles] = useState(false);
  const [showAssignRoles, setShowAssignRoles] = useState(false);
  const [selectedAcceptedMemberId, setSelectedAcceptedMemberId] = useState<string | null>(null);
  const [selectedCurrentMemberId, setSelectedCurrentMemberId] = useState<string | null>(null);
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  const roleRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    try {
      const storedFont = normalizeStoredFont(localStorage.getItem(FONT_STORAGE_KEY));
      const storedSpacing = (localStorage.getItem(SPACING_STORAGE_KEY) as SpacingOption | null) ?? "default";
      const storedTheme = normalizeStoredTheme(localStorage.getItem(THEME_STORAGE_KEY));
      setSelectedFont(storedFont);
      setBaselineFont(storedFont);
      setSelectedSpacing(storedSpacing);
      setBaselineSpacing(storedSpacing);
      setSelectedTheme(storedTheme);
      setBaselineTheme(storedTheme);
      applyFont(storedFont);
      applySpacing(storedSpacing);
      applyTheme(storedTheme);
    } catch {
      applyFont("grotesk");
      applySpacing("default");
      applyTheme("system");
    }
  }, []);

  useEffect(() => {
    if (!canManageRoles) {
      setRoles([]);
      setAssignments([]);
      setInvites([]);
      setRolesLoading(false);
      setRolesError(null);
      return;
    }
    let active = true;

    const loadRoles = async (): Promise<void> => {
      setRolesLoading(true);
      setRolesError(null);
      try {
        const [rolesData, assignmentData, inviteData] = await Promise.all([
          listRoles(),
          listRoleAssignments(),
          listInvites()
        ]);

        if (!active) return;

        setRoles(rolesData);
        setAssignments(assignmentData);
        setInvites(inviteData);
        setUserRoleDrafts(
          Object.fromEntries(assignmentData.map((user) => [user.id, normalizeRoleIds(user.roleIds)]))
        );
        setRoleDrafts(
          Object.fromEntries(
            rolesData.map((role) => [role.id, { name: role.name, color: role.color, permissions: role.permissions }])
          )
        );
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Failed to load roles";
        setRolesError(message);
      } finally {
        if (active) setRolesLoading(false);
      }
    };

    void loadRoles();

    return () => {
      active = false;
    };
  }, [canManageRoles]);

  useEffect(() => {
    if (!showManageRoles || roles.length === 0) return;
    setActiveRoleId((current) => {
      if (current && roles.some((role) => role.id === current)) return current;
      return roles[0]?.id ?? null;
    });
  }, [showManageRoles, roles]);

  const hasUnsavedChanges =
    selectedFont !== baselineFont || selectedSpacing !== baselineSpacing || selectedTheme !== baselineTheme;

  const helperText = useMemo(() => {
    if (status === "saved" && !hasUnsavedChanges) {
      return "Settings saved.";
    }

    return "Some settings apply after saving. Collaboration controls will be wired up later.";
  }, [status, hasUnsavedChanges]);

  const assignmentById = useMemo(() => {
    return new Map(assignments.map((member) => [member.id, member]));
  }, [assignments]);

  const acceptedInvites = useMemo(
    () => invites.filter((invite) => invite.status === "accepted" && invite.acceptedBy),
    [invites]
  );

  const acceptedMembers = useMemo(() => {
    return acceptedInvites.flatMap((invite) => {
      const member = invite.acceptedBy ? assignmentById.get(invite.acceptedBy) : undefined;
      return member ? [{ invite, member }] : [];
    });
  }, [acceptedInvites, assignmentById]);

  const acceptedInviteIds = useMemo(() => {
    return new Set(acceptedInvites.map((invite) => invite.acceptedBy!).filter(Boolean));
  }, [acceptedInvites]);

  const currentMembers = useMemo(() => {
    return assignments.filter((member) => !acceptedInviteIds.has(member.id));
  }, [assignments, acceptedInviteIds]);

  const selectedAcceptedMember = selectedAcceptedMemberId
    ? acceptedMembers.find((entry) => entry.member.id === selectedAcceptedMemberId)?.member ?? null
    : null;

  const selectedCurrentMember = selectedCurrentMemberId
    ? currentMembers.find((member) => member.id === selectedCurrentMemberId) ?? null
    : null;

  const getRoleIdsForUser = (memberId: string): string[] => {
    return userRoleDrafts[memberId] ?? assignmentById.get(memberId)?.roleIds ?? [];
  };

  const getInitials = (label: string): string => {
    const parts = label.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "??";
    const initials = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
    return initials.slice(0, 2) || "??";
  };

  const renderRoleEditor = (member: UserRoleAssignment | null): JSX.Element => {
    if (!member) {
      return <p className="text-sm text-muted-foreground">Select a member to review and assign roles.</p>;
    }

    const memberLabel = member.displayName ?? member.name;
    const memberHandle = member.username ? `@${member.username}` : member.email;
    const assignedRoleIds = getRoleIdsForUser(member.id);
    const assignedRoles = roles.filter((role) => assignedRoleIds.includes(role.id));

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <UserHoverCard user={member}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {getInitials(memberLabel)}
              </div>
            </UserHoverCard>
            <div>
              <UserHoverCard user={member}>
                <p className="text-sm font-semibold">{memberLabel}</p>
              </UserHoverCard>
              <p className="text-xs text-muted-foreground">{memberHandle}</p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              void onSaveUserRoles(member.id);
            }}
            disabled={savingUsers.has(member.id)}
          >
            {savingUsers.has(member.id) ? "Saving..." : "Save roles"}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {assignedRoles.length === 0 ? (
            <span className="rounded-full border border-dashed border-border/60 px-3 py-1 text-xs text-muted-foreground">
              No roles assigned yet
            </span>
          ) : (
            assignedRoles.map((role) => (
              <span
                key={role.id}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
                style={{ borderColor: role.color, color: role.color }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: role.color }} />
                {role.name}
              </span>
            ))
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {roles.map((role) => {
            const isAssigned = assignedRoleIds.includes(role.id);
            const isRequired = isAssigned && assignedRoleIds.length === 1;
            return (
              <button
                key={role.id}
                type="button"
                disabled={isRequired}
                onClick={() => {
                  const next = isAssigned
                    ? assignedRoleIds.filter((id) => id !== role.id)
                    : [...assignedRoleIds, role.id];
                  onChangeUserRoles(member.id, next);
                }}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                  isAssigned
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border/60 bg-card/60 text-foreground/90 hover:border-primary/30 hover:bg-card"
                } ${isRequired ? "cursor-not-allowed opacity-70" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: role.color }} />
                  <span>{role.name}</span>
                </span>
                <span className={`text-xs font-semibold ${
                  isRequired
                    ? "text-muted-foreground"
                    : isAssigned
                      ? "text-emerald-600"
                      : "text-muted-foreground"
                }`}
                >
                  {isRequired ? "Required" : isAssigned ? "Assigned" : "Add"}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">Select one or more roles. At least one role is required.</p>
      </div>
    );
  };

  useEffect(() => {
    if (!showAssignRoles) return;
    setSelectedAcceptedMemberId((current) => {
      if (current && acceptedMembers.some((entry) => entry.member.id === current)) return current;
      return acceptedMembers[0]?.member.id ?? null;
    });
    setSelectedCurrentMemberId((current) => {
      if (current && currentMembers.some((member) => member.id === current)) return current;
      return currentMembers[0]?.id ?? null;
    });
  }, [showAssignRoles, acceptedMembers, currentMembers]);

  const activeRole = activeRoleId
    ? roles.find((role) => role.id === activeRoleId) ?? roles[0] ?? null
    : roles[0] ?? null;

  const activeRoleDraft = activeRole
    ? roleDrafts[activeRole.id] ?? { name: activeRole.name, color: activeRole.color, permissions: activeRole.permissions }
    : null;

  const activeRoleDirty = activeRole && activeRoleDraft
    ? activeRoleDraft.name !== activeRole.name ||
      activeRoleDraft.color !== activeRole.color ||
      !permissionsMatch(activeRoleDraft.permissions, activeRole.permissions)
    : false;

  const activeRoleSaving = activeRole ? savingRoles.has(activeRole.id) : false;
  const onSave = (): void => {
    try {
      localStorage.setItem(FONT_STORAGE_KEY, selectedFont);
      localStorage.setItem(SPACING_STORAGE_KEY, selectedSpacing);
      localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
    } catch {
      // ignore storage failures
    }
    applyFont(selectedFont);
    applySpacing(selectedSpacing);
    applyTheme(selectedTheme);
    setBaselineFont(selectedFont);
    setBaselineSpacing(selectedSpacing);
    setBaselineTheme(selectedTheme);
    setStatus("saved");
  };

  const onToggleNewRolePermission = (permission: RolePermission): void => {
    setNewRolePermissions((current) => togglePermission(current, permission));
  };

  const onCreateRole = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!newRoleName.trim()) {
      setRolesError("Role name is required");
      return;
    }
    if (newRolePermissions.length === 0) {
      setRolesError("Select at least one permission");
      return;
    }

    setCreatingRole(true);
    setRolesError(null);

    try {
      const created = await createRole({
        name: newRoleName.trim(),
        color: newRoleColor,
        permissions: newRolePermissions
      });

      setRoles((current) => [...current, created].sort((a, b) => b.priority - a.priority));
      setRoleDrafts((current) => ({
        ...current,
        [created.id]: { name: created.name, color: created.color, permissions: created.permissions }
      }));
      setNewRoleName("");
      setNewRoleColor("#64748b");
      setNewRolePermissions(["view_boards"]);
      setShowCreateRole(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create role";
      setRolesError(message);
    } finally {
      setCreatingRole(false);
    }
  };

  const onChangeUserRoles = (userId: string, value: string[]): void => {
    setUserRoleDrafts((current) => ({
      ...current,
      [userId]: normalizeRoleIds(value)
    }));
  };

  const onSaveUserRoles = async (userId: string): Promise<void> => {
    const nextRoles = userRoleDrafts[userId] ?? [];
    setSavingUsers((current) => new Set(current).add(userId));
    try {
      const updated = await updateUserRoles(userId, nextRoles);
      setAssignments((current) => current.map((user) => (user.id === userId ? updated : user)));
      setUserRoleDrafts((current) => ({ ...current, [userId]: normalizeRoleIds(updated.roleIds) }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update roles";
      setRolesError(message);
    } finally {
      setSavingUsers((current) => {
        const next = new Set(current);
        next.delete(userId);
        return next;
      });
    }
  };

  const onChangeRoleDraft = (roleId: string, next: Partial<RoleDraft>): void => {
    setRoleDrafts((current) => {
      const existing = current[roleId] ?? { name: "", color: "#64748b", permissions: [] };
      return {
        ...current,
        [roleId]: { ...existing, ...next }
      };
    });
  };

  const onToggleRolePermission = (roleId: string, permission: RolePermission): void => {
    setRoleDrafts((current) => {
      const existing = current[roleId];
      if (!existing) return current;
      return {
        ...current,
        [roleId]: { ...existing, permissions: togglePermission(existing.permissions, permission) }
      };
    });
  };

  const onSaveRole = async (role: RoleSummary): Promise<void> => {
    const draft = roleDrafts[role.id];
    if (!draft) return;
    setSavingRoles((current) => new Set(current).add(role.id));
    setRolesError(null);

    try {
      const payload = role.isSystem
        ? { color: draft.color, permissions: draft.permissions }
        : { name: draft.name, color: draft.color, permissions: draft.permissions };
      const updated = await updateRole(role.id, payload);
      setRoles((current) => current.map((item) => (item.id === role.id ? updated : item)));
      setRoleDrafts((current) => ({
        ...current,
        [role.id]: { name: updated.name, color: updated.color, permissions: updated.permissions }
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update role";
      setRolesError(message);
    } finally {
      setSavingRoles((current) => {
        const next = new Set(current);
        next.delete(role.id);
        return next;
      });
    }
  };

  const onDeleteRole = async (roleId: string): Promise<void> => {
    setDeletingRoles((current) => new Set(current).add(roleId));
    setRolesError(null);
    try {
      await deleteRole(roleId);
      setRoles((current) => current.filter((role) => role.id !== roleId));
      setRoleDrafts((current) => {
        const next = { ...current };
        delete next[roleId];
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete role";
      setRolesError(message);
    } finally {
      setDeletingRoles((current) => {
        const next = new Set(current);
        next.delete(roleId);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">General settings</h2>
          <p className="text-sm text-muted-foreground">{helperText}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasUnsavedChanges && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
              Unsaved changes
            </span>
          )}
          <Button type="button" onClick={onSave} disabled={!hasUnsavedChanges}>
            {hasUnsavedChanges ? "Save changes" : "Up to date"}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
            <CardDescription>Access levels, permissions, and assignments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {canManageRoles ? (
              <>
                <Button type="button" className="w-full" onClick={() => setShowCreateRole(true)}>
                  Create role
                </Button>
                <Button type="button" variant="secondary" className="w-full" onClick={() => setShowManageRoles(true)}>
                  Manage roles
                </Button>
                <Button type="button" variant="secondary" className="w-full" onClick={() => setShowAssignRoles(true)}>
                  Assign roles
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Roles are managed by admins. Ask your admin if you need changes.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Pick a theme that fits your focus.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant={selectedTheme === "light" ? "default" : "secondary"}
              type="button"
              onClick={() => {
                setSelectedTheme("light");
                setStatus("idle");
              }}
            >
              Light
            </Button>
            <Button
              variant={selectedTheme === "dark" ? "default" : "secondary"}
              type="button"
              onClick={() => {
                setSelectedTheme("dark");
                setStatus("idle");
              }}
            >
              Dark
            </Button>
            <Button
              variant={selectedTheme === "system" ? "default" : "secondary"}
              type="button"
              onClick={() => {
                setSelectedTheme("system");
                setStatus("idle");
              }}
            >
              System
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Typography</CardTitle>
            <CardDescription>Choose the reading style you prefer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Font</label>
            <select
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={selectedFont}
              onChange={(event) => {
                setSelectedFont(event.target.value as FontOption);
                setStatus("idle");
              }}
            >
              {fontOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} · {option.description}
                </option>
              ))}
            </select>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Spacing</label>
            <select
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={selectedSpacing}
              onChange={(event) => {
                setSelectedSpacing(event.target.value as SpacingOption);
                setStatus("idle");
              }}
            >
              {spacingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} · {option.description}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Adjust email and in-app alerts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Notification rules will sync here once messaging is enabled.</p>
            <Button variant="secondary" disabled>
              Coming soon
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">Typography updates apply after saving.</p>

      <SettingsModal
        open={showCreateRole}
        title="Create role"
        description="Design a new role with a name, color, and permission set."
        onClose={() => setShowCreateRole(false)}
      >
        {rolesError && <p className="text-sm text-destructive">{rolesError}</p>}
        <div className="sticky top-0 z-10 -mx-6 border-b border-border/60 bg-background/95 px-6 py-3 backdrop-blur">
          <div className="flex items-center justify-end">
            <Button type="submit" form="create-role-form" disabled={creatingRole}>
              {creatingRole ? "Creating..." : "Create role"}
            </Button>
          </div>
        </div>
        <form id="create-role-form" className="space-y-4" onSubmit={onCreateRole}>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              placeholder="Role name"
              value={newRoleName}
              onChange={(event) => setNewRoleName(event.target.value)}
            />
            <Input
              type="color"
              value={newRoleColor}
              onChange={(event) => setNewRoleColor(event.target.value)}
              className="h-10 w-full sm:w-16"
            />
          </div>
          {permissionGroups.map((group) => (
            <div key={group.id} className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">{group.title}</h3>
                <p className="text-xs text-muted-foreground">{group.description}</p>
              </div>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <PermissionToggleRow
                    key={item.permission}
                    item={item}
                    enabled={newRolePermissions.includes(item.permission)}
                    onToggle={() => onToggleNewRolePermission(item.permission)}
                  />
                ))}
              </div>
            </div>
          ))}
        </form>
      </SettingsModal>

      <SettingsModal
        open={showManageRoles}
        title="Manage roles"
        description="Review existing roles, adjust permissions, and remove custom roles."
        onClose={() => setShowManageRoles(false)}
      >
        {rolesError && <p className="text-sm text-destructive">{rolesError}</p>}
        {rolesLoading ? (
          <p className="text-sm text-muted-foreground">Loading roles...</p>
        ) : (
          <div className="space-y-6">
            <div className="sticky top-0 z-10 -mx-6 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-6 py-3 backdrop-blur">
              <div className="flex flex-wrap items-center gap-2">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setActiveRoleId(role.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      activeRole?.id === role.id
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/60 text-foreground/80 hover:border-primary/30 hover:bg-secondary/70"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: role.color }} />
                    {role.name}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (activeRole) {
                    void onSaveRole(activeRole);
                  }
                }}
                disabled={!activeRole || !activeRoleDirty || activeRoleSaving}
              >
                {activeRoleSaving ? "Saving..." : activeRoleDirty ? "Save role" : "Up to date"}
              </Button>
            </div>

            {activeRole && activeRoleDraft ? (
              <Card className="border-border/60 bg-card/80 shadow-sm">
                <CardHeader className="space-y-1">
                  <CardTitle>Role details</CardTitle>
                  <CardDescription>Update role identity and permissions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Role name
                      </label>
                      <Input
                        value={activeRoleDraft.name}
                        onChange={(event) => onChangeRoleDraft(activeRole.id, { name: event.target.value })}
                        disabled={activeRole.isSystem}
                      />
                      {activeRole.isSystem && (
                        <p className="text-xs text-muted-foreground">System role names are locked.</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Color
                      </label>
                      <Input
                        type="color"
                        value={activeRoleDraft.color}
                        onChange={(event) => onChangeRoleDraft(activeRole.id, { color: event.target.value })}
                        className="h-10 w-full sm:w-16"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    {permissionGroups.map((group) => (
                      <div key={group.id} className="space-y-3">
                        <div>
                          <h3 className="text-sm font-semibold">{group.title}</h3>
                          <p className="text-xs text-muted-foreground">{group.description}</p>
                        </div>
                        <div className="space-y-2">
                          {group.items.map((item) => (
                            <PermissionToggleRow
                              key={item.permission}
                              item={item}
                              enabled={activeRoleDraft.permissions.includes(item.permission)}
                              onToggle={() => onToggleRolePermission(activeRole.id, item.permission)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {!activeRole.isSystem && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          void onDeleteRole(activeRole.id);
                        }}
                        disabled={deletingRoles.has(activeRole.id)}
                      >
                        {deletingRoles.has(activeRole.id) ? "Deleting..." : "Delete role"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <p className="text-sm text-muted-foreground">Select a role to edit its permissions.</p>
            )}
          </div>
        )}
      </SettingsModal>


      <SettingsModal
        open={showAssignRoles}
        title="Assign roles"
        description="Assign roles to people who have joined the workspace."
        onClose={() => setShowAssignRoles(false)}
      >
        {rolesError && <p className="text-sm text-destructive">{rolesError}</p>}
        {rolesLoading ? (
          <p className="text-sm text-muted-foreground">Loading assignments...</p>
        ) : (
          <div className="space-y-6">
            <Card className="border-border/60 bg-card/80 shadow-sm">
              <CardHeader className="space-y-1">
                <CardTitle>Accepted invite members</CardTitle>
                <CardDescription>Newly joined users who came in through an invite.</CardDescription>
              </CardHeader>
              <CardContent>
                {acceptedMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No accepted invites yet.</p>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
                    <div className="rounded-xl border border-border/60 bg-muted/40 p-2">
                      <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Members
                      </div>
                      <div className="max-h-64 overflow-y-auto pr-1">
                        <div className="space-y-1">
                          {acceptedMembers.map(({ member }) => {
                            const label = member.displayName ?? member.name;
                            const handle = member.username ? `@${member.username}` : member.email;
                            const isActive = selectedAcceptedMemberId === member.id;
                            return (
                              <button
                                key={member.id}
                                type="button"
                                onClick={() => setSelectedAcceptedMemberId(member.id)}
                                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                                  isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-foreground/80 hover:bg-secondary/70"
                                }`}
                              >
                                <div className="font-medium">{label}</div>
                                <div className="text-xs text-muted-foreground">{handle}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card/90 p-4 shadow-sm">
                      {renderRoleEditor(selectedAcceptedMember)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/80 shadow-sm">
              <CardHeader className="space-y-1">
                <CardTitle>Current members</CardTitle>
                <CardDescription>Assign roles to existing workspace members.</CardDescription>
              </CardHeader>
              <CardContent>
                {currentMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No members yet.</p>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
                    <div className="rounded-xl border border-border/60 bg-muted/40 p-2">
                      <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Members
                      </div>
                      <div className="max-h-64 overflow-y-auto pr-1">
                        <div className="space-y-1">
                          {currentMembers.map((member) => {
                            const label = member.displayName ?? member.name;
                            const handle = member.username ? `@${member.username}` : member.email;
                            const isActive = selectedCurrentMemberId === member.id;
                            return (
                              <button
                                key={member.id}
                                type="button"
                                onClick={() => setSelectedCurrentMemberId(member.id)}
                                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                                  isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-foreground/80 hover:bg-secondary/70"
                                }`}
                              >
                                <div className="font-medium">{label}</div>
                                <div className="text-xs text-muted-foreground">{handle}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card/90 p-4 shadow-sm">
                      {renderRoleEditor(selectedCurrentMember)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </SettingsModal>

    </div>
  );
}






