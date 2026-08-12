declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        email: string;
      };
      workspace?: {
        id: string;
        name: string;
        slug: string;
        status: "active" | "archived";
        role: "admin" | "member" | "guest";
        joinedAt: Date;
        lastAccessedAt: Date | null;
      };
      requestId?: string;
    }
  }
}

export {};

