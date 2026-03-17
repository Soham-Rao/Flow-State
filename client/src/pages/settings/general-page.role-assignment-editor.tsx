import { Button } from "@/components/ui/button";
import { UserHoverCard } from "@/components/users/user-hover-card";
import type { RoleSummary, UserRoleAssignment } from "@/types/roles";

export type RoleAssignmentEditorProps = {
  member: UserRoleAssignment | null;
  roles: RoleSummary[];
  getRoleIdsForUser: (memberId: string) => string[];
  onChangeUserRoles: (userId: string, value: string[]) => void;
  onSaveUserRoles: (userId: string) => void;
  savingUsers: Set<string>;
};

function getInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return initials.slice(0, 2) || "??";
}

export function RoleAssignmentEditor({
  member,
  roles,
  getRoleIdsForUser,
  onChangeUserRoles,
  onSaveUserRoles,
  savingUsers
}: RoleAssignmentEditorProps): JSX.Element {
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
              <span
                className={`text-xs font-semibold ${
                  isRequired ? "text-muted-foreground" : isAssigned ? "text-emerald-600" : "text-muted-foreground"
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
}

