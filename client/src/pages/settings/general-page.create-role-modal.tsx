import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RolePermission } from "@/types/roles";
import { permissionGroups } from "./general-page.constants";
import { PermissionToggleRow, SettingsModal } from "./general-page.components";

type CreateRoleModalProps = {
  open: boolean;
  onClose: () => void;
  rolesError: string | null;
  creatingRole: boolean;
  newRoleName: string;
  newRoleColor: string;
  newRolePermissions: RolePermission[];
  onNameChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onTogglePermission: (permission: RolePermission) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function CreateRoleModal({
  open,
  onClose,
  rolesError,
  creatingRole,
  newRoleName,
  newRoleColor,
  newRolePermissions,
  onNameChange,
  onColorChange,
  onTogglePermission,
  onSubmit
}: CreateRoleModalProps): JSX.Element {
  return (
    <SettingsModal
      open={open}
      title="Create role"
      description="Design a new role with a name, color, and permission set."
      onClose={onClose}
    >
      {rolesError && <p className="text-sm text-destructive">{rolesError}</p>}
      <div className="sticky top-0 z-10 -mx-6 border-b border-border/60 bg-background/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center justify-end">
          <Button type="submit" form="create-role-form" disabled={creatingRole}>
            {creatingRole ? "Creating..." : "Create role"}
          </Button>
        </div>
      </div>
      <form id="create-role-form" className="space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            placeholder="Role name"
            value={newRoleName}
            onChange={(event) => onNameChange(event.target.value)}
          />
          <Input
            type="color"
            value={newRoleColor}
            onChange={(event) => onColorChange(event.target.value)}
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
                  onToggle={() => onTogglePermission(item.permission)}
                />
              ))}
            </div>
          </div>
        ))}
      </form>
    </SettingsModal>
  );
}
