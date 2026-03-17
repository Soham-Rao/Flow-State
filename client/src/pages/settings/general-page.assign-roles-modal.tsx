import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RoleSummary, UserRoleAssignment } from "@/types/roles";
import { RoleAssignmentEditor } from "./general-page.role-assignment-editor";
import { SettingsModal } from "./general-page.components";

type AcceptedMemberEntry = {
  member: UserRoleAssignment;
};

type AssignRolesModalProps = {
  open: boolean;
  onClose: () => void;
  rolesError: string | null;
  rolesLoading: boolean;
  acceptedMembers: AcceptedMemberEntry[];
  currentMembers: UserRoleAssignment[];
  roles: RoleSummary[];
  getRoleIdsForUser: (memberId: string) => string[];
  onChangeUserRoles: (userId: string, value: string[]) => void;
  onSaveUserRoles: (userId: string) => Promise<void>;
  savingUsers: Set<string>;
};

export function AssignRolesModal({
  open,
  onClose,
  rolesError,
  rolesLoading,
  acceptedMembers,
  currentMembers,
  roles,
  getRoleIdsForUser,
  onChangeUserRoles,
  onSaveUserRoles,
  savingUsers
}: AssignRolesModalProps): JSX.Element {
  const [selectedAcceptedMemberId, setSelectedAcceptedMemberId] = useState<string | null>(null);
  const [selectedCurrentMemberId, setSelectedCurrentMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedAcceptedMemberId((current) => {
      if (current && acceptedMembers.some((entry) => entry.member.id === current)) return current;
      return acceptedMembers[0]?.member.id ?? null;
    });
    setSelectedCurrentMemberId((current) => {
      if (current && currentMembers.some((member) => member.id === current)) return current;
      return currentMembers[0]?.id ?? null;
    });
  }, [open, acceptedMembers, currentMembers]);

  const selectedAcceptedMember = selectedAcceptedMemberId
    ? acceptedMembers.find((entry) => entry.member.id === selectedAcceptedMemberId)?.member ?? null
    : null;

  const selectedCurrentMember = selectedCurrentMemberId
    ? currentMembers.find((member) => member.id === selectedCurrentMemberId) ?? null
    : null;

  return (
    <SettingsModal
      open={open}
      title="Assign roles"
      description="Assign roles to people who have joined the workspace."
      onClose={onClose}
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
                    <RoleAssignmentEditor
                      member={selectedAcceptedMember}
                      roles={roles}
                      getRoleIdsForUser={getRoleIdsForUser}
                      onChangeUserRoles={onChangeUserRoles}
                      onSaveUserRoles={onSaveUserRoles}
                      savingUsers={savingUsers}
                    />
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
                    <RoleAssignmentEditor
                      member={selectedCurrentMember}
                      roles={roles}
                      getRoleIdsForUser={getRoleIdsForUser}
                      onChangeUserRoles={onChangeUserRoles}
                      onSaveUserRoles={onSaveUserRoles}
                      savingUsers={savingUsers}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </SettingsModal>
  );
}
