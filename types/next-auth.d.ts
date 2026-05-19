import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      memberId: string | null;
      departmentIds: string[];
      totpEnabled: boolean;
      expiresAt: number; // epoch (s) — expiração absoluta por papel
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    memberId?: string | null;
    departmentIds?: string[];
    totpEnabled?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    memberId?: string | null;
    departmentIds?: string[];
    totpEnabled?: boolean;
    expiresAt?: number;
  }
}
