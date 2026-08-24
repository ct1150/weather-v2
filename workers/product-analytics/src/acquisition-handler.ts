import { renderAcquisitionDashboard } from "./acquisition-dashboard";

function basicPassword(header: string | null): string | null {
  if (header === null || !header.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    return separator >= 0 ? decoded.slice(separator + 1) : null;
  } catch {
    return null;
  }
}

export async function handleAcquisitionDashboardRequest(
  request: Request,
  input: { readonly db: D1Database; readonly password: string },
): Promise<Response> {
  if (input.password.length < 12) return new Response("Not found", { status: 404 });
  if (basicPassword(request.headers.get("authorization")) !== input.password) {
    return new Response("Authentication required", {
      status: 401,
      headers: { "www-authenticate": 'Basic realm="Where Not Rain Growth", charset="UTF-8"' },
    });
  }
  const html = await renderAcquisitionDashboard(input.db);
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export async function injectAcquisitionNavigation(response: Response): Promise<Response> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes("text/html")) return response;
  const html = await response.text();
  const navigation = '<p class="growth-nav"><a href="/growth/acquisition">查看用户来源分析 →</a></p>';
  const body = html.includes("</header>") ? html.replace("</header>", `${navigation}</header>`) : html;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(body, { status: response.status, headers });
}
