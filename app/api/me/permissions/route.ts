import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { resolveUserPermissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = toSessionUser(session.user);
  const permissions = await resolveUserPermissions(user);
  return NextResponse.json({ permissions, role: user.role });
}
