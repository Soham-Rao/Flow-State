export interface AnnouncementAudience {
  sendToAll: boolean;
  includeRoleIds: string[];
  excludeRoleIds: string[];
  includeUserIds: string[];
  excludeUserIds: string[];
}

export interface AnnouncementAudienceOptions {
  roles: Array<{ id: string; name: string; color: string }>;
  users: Array<{ id: string; name: string; displayName: string | null; username: string | null; email: string; role: string }>;
}

export interface AnnouncementDetail {
  id: string;
  subject: string;
  body: string;
  createdAt: number;
  author: {
    id: string;
    name: string;
    displayName: string | null;
    email: string;
  };
}
