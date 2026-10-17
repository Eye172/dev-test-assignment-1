import { NextResponse, type NextRequest } from "next/server";
import { isLocale, isTheme, isVersion, prefCookies } from "./ui/prefs";

/** `?ui=`, `?lang=` and `?theme=` are shareable switches: store them as device cookies, then drop them from the URL. */
export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const ui = url.searchParams.get("ui"), lang = url.searchParams.get("lang"), theme = url.searchParams.get("theme");
  if (!ui && !lang && !theme) return NextResponse.next();
  const clean = url.clone();
  ["ui", "lang", "theme"].forEach(key => clean.searchParams.delete(key));
  const response = NextResponse.redirect(clean);
  const options = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };
  if (isVersion(ui)) response.cookies.set(prefCookies.ui, ui, options);
  if (isLocale(lang)) response.cookies.set(prefCookies.locale, lang, options);
  if (isTheme(theme)) response.cookies.set(prefCookies.theme, theme, options);
  return response;
}
export const config = { matcher: ["/((?!api|_next|brand|icon.svg|pdf.worker).*)"] };
