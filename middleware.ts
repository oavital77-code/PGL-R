import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/api/webhooks(.*)", "/api/cron(.*)", "/api/health"]);

export default clerkMiddleware(async (auth, req) => {
  // expose the pathname to server layouts (onboarding gate)
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  if (isPublicRoute(req)) return NextResponse.next({ request: { headers } });
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: req.url });
  return NextResponse.next({ request: { headers } });
});

export const config = {
  matcher: ["/((?!_next|fonts|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|css|js|map)$).*)", "/(api|trpc)(.*)"],
};
