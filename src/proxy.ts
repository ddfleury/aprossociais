import { type NextRequest, NextResponse } from "next/server";

// O cron é público apenas no proxy: o próprio Route Handler exige um Bearer
// comparado em tempo constante. Sem esta exceção, o proxy o redirecionaria ao login.
const PUBLIC_PATHS = [
  "/login",
  "/validar",
  "/api/health",
  "/api/cron/comunicacoes",
];

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (isPublic) return NextResponse.next();

  const cookieName =
    process.env.NODE_ENV === "production"
      ? "__Host-apros_session"
      : "apros_session";
  if (!request.cookies.has(cookieName)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
