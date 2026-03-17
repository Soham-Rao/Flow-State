import type { RolePermission } from "@/types/roles";

export const FONT_STORAGE_KEY = "flowstate:font";
export const SPACING_STORAGE_KEY = "flowstate:spacing";
export const THEME_STORAGE_KEY = "flowstate:theme";

export type FontOption = "grotesk" | "serif" | "plex" | "merriweather";

export type ThemeOption = "light" | "dark" | "system";

export type SpacingOption = "tight" | "compact" | "default" | "spacious";

export type RoleDraft = {
  name: string;
  color: string;
  permissions: RolePermission[];
};

export type PermissionItem = {
  permission: RolePermission;
  title: string;
  description: string;
  enabledLabel: string;
  disabledLabel: string;
};

export type PermissionGroup = {
  id: string;
  title: string;
  description: string;
  items: PermissionItem[];
};

export const fontOptions: Array<{ value: FontOption; label: string; description: string }> = [
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

export const spacingOptions: Array<{ value: SpacingOption; label: string; description: string }> = [
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

export const permissionGroups: PermissionGroup[] = [
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
        description: "Review workspace events and audit logs.",
        enabledLabel: "Can view activity logs",
        disabledLabel: "Cannot view activity logs"
      }
    ]
  },
  {
    id: "boards",
    title: "Boards & lists",
    description: "Create, update, and manage boards and their lists.",
    items: [
      {
        permission: "view_boards",
        title: "View boards",
        description: "See boards and all their lists and cards.",
        enabledLabel: "Can view all boards",
        disabledLabel: "Cannot view boards"
      },
      {
        permission: "create_boards",
        title: "Create boards",
        description: "Create new boards in the workspace.",
        enabledLabel: "Can create boards",
        disabledLabel: "Cannot create boards"
      },
      {
        permission: "edit_boards",
        title: "Edit boards",
        description: "Rename or update board details.",
        enabledLabel: "Can edit boards",
        disabledLabel: "Cannot edit boards"
      },
      {
        permission: "delete_boards",
        title: "Delete boards",
        description: "Archive or delete existing boards.",
        enabledLabel: "Can delete boards",
        disabledLabel: "Cannot delete boards"
      },
      {
        permission: "manage_lists",
        title: "Manage lists",
        description: "Create, edit, and reorder lists on boards.",
        enabledLabel: "Can manage lists",
        disabledLabel: "Cannot manage lists"
      }
    ]
  },
  {
    id: "cards",
    title: "Cards",
    description: "Work on tasks, assignments, and metadata inside cards.",
    items: [
      {
        permission: "create_cards",
        title: "Create cards",
        description: "Add new cards to lists.",
        enabledLabel: "Can create cards",
        disabledLabel: "Cannot create cards"
      },
      {
        permission: "edit_cards",
        title: "Edit cards",
        description: "Update card titles, descriptions, and metadata.",
        enabledLabel: "Can edit cards",
        disabledLabel: "Cannot edit cards"
      },
      {
        permission: "delete_cards_own",
        title: "Delete own cards",
        description: "Remove cards you created.",
        enabledLabel: "Can delete own cards",
        disabledLabel: "Cannot delete own cards"
      },
      {
        permission: "delete_cards_any",
        title: "Delete any card",
        description: "Remove cards created by anyone.",
        enabledLabel: "Can delete any card",
        disabledLabel: "Cannot delete other people's cards"
      },
      {
        permission: "assign_members",
        title: "Assign members",
        description: "Assign people to cards.",
        enabledLabel: "Can assign members",
        disabledLabel: "Cannot assign members"
      },
      {
        permission: "set_due_dates",
        title: "Set due dates",
        description: "Add or update due dates.",
        enabledLabel: "Can set due dates",
        disabledLabel: "Cannot set due dates"
      },
      {
        permission: "manage_checklists",
        title: "Manage checklists",
        description: "Create and update card checklists.",
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
        description: "Create and edit labels.",
        enabledLabel: "Can manage labels",
        disabledLabel: "Cannot manage labels"
      }
    ]
  },
  {
    id: "comments",
    title: "Comments & mentions",
    description: "Collaborate inside cards and threads.",
    items: [
      {
        permission: "comment",
        title: "Post comments",
        description: "Write comments on cards and threads.",
        enabledLabel: "Can comment",
        disabledLabel: "Cannot comment"
      },
      {
        permission: "edit_comments",
        title: "Edit comments",
        description: "Edit your own comments.",
        enabledLabel: "Can edit comments",
        disabledLabel: "Cannot edit comments"
      },
      {
        permission: "delete_comments",
        title: "Delete comments",
        description: "Remove any comment.",
        enabledLabel: "Can delete comments",
        disabledLabel: "Cannot delete comments"
      },
      {
        permission: "react",
        title: "React with emojis",
        description: "React to comments and tasks.",
        enabledLabel: "Can react",
        disabledLabel: "Cannot react"
      },
      {
        permission: "mention_users",
        title: "Mention users",
        description: "Mention teammates in comments.",
        enabledLabel: "Can mention users",
        disabledLabel: "Cannot mention users"
      },
      {
        permission: "mention_roles",
        title: "Mention roles",
        description: "Mention roles in comments.",
        enabledLabel: "Can mention roles",
        disabledLabel: "Cannot mention roles"
      }
    ]
  },
  {
    id: "threads",
    title: "Threads & DMs",
    description: "Access direct messages and thread sections.",
    items: [
      {
        permission: "view_threads",
        title: "View threads",
        description: "Open the threads area and browse DMs.",
        enabledLabel: "Can view threads",
        disabledLabel: "Cannot view threads"
      },
      {
        permission: "create_threads",
        title: "Create threads",
        description: "Start new message threads.",
        enabledLabel: "Can create threads",
        disabledLabel: "Cannot create threads"
      },
      {
        permission: "reply_threads",
        title: "Reply in threads",
        description: "Reply within existing threads.",
        enabledLabel: "Can reply in threads",
        disabledLabel: "Cannot reply in threads"
      },
      {
        permission: "delete_threads",
        title: "Delete threads",
        description: "Remove threads and their messages.",
        enabledLabel: "Can delete threads",
        disabledLabel: "Cannot delete threads"
      },
      {
        permission: "pin_threads",
        title: "Pin threads",
        description: "Pin threads for quick access.",
        enabledLabel: "Can pin threads",
        disabledLabel: "Cannot pin threads"
      }
    ]
  },
  {
    id: "settings",
    title: "Settings",
    description: "Control access to settings screens.",
    items: [
      {
        permission: "view_settings",
        title: "View settings",
        description: "Open the settings pages.",
        enabledLabel: "Can view settings",
        disabledLabel: "Cannot view settings"
      }
    ]
  }
];
