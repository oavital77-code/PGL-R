import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { signedUrl } from "@/lib/storage";
import { canReadDocument, getDocument } from "@/lib/storage/access";

/** Issues a short-lived signed URL (10 min) and redirects to it (spec §2.4). ?inline=1 keeps the preview. */
export async function GET(req: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { documentId } = await params;
  const doc = await getDocument(documentId);
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!(await canReadDocument(user, doc))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  const url = await signedUrl(doc.storageBucket, doc.storagePath, inline ? undefined : doc.fileName);
  return NextResponse.redirect(url, { status: 302 });
}
