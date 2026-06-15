import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /api/cron/* secures itself via CRON_SECRET (see app/api/cron/*), so it must
// bypass the Supabase session gate — cron requests carry no auth cookie.
// /api/public/* is intentionally open (unauthenticated read-only JSON).
const publicPaths = ["/login", "/api/cron", "/api/public"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({ request });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  // getSession() reads the cookie locally and only makes a network call when the
  // access token has expired (to refresh it). This is a routing gate, not an auth
  // check — every page re-verifies the user via supabase.auth.getUser() in
  // requireProfile(), so a forged cookie gets past middleware but not the page.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const path = request.nextUrl.pathname;
  const isPublic = publicPaths.some((publicPath) => path === publicPath || path.startsWith(`${publicPath}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    // Send to "/" so the root route applies role-based landing
    // (division_incharge → /fuel, everyone else → /dashboard).
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|webmanifest)$).*)",
  ],
};

