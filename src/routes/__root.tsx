import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useState } from "react";
import { Toaster } from "sonner";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { ThemeProvider } from "@/components/theme-provider";
import { LocalSessionProvider } from "@/lib/local-session";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "description", content: APP_TAGLINE },
      { name: "theme-color", content: "#111111" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: RootDocument,
});

/** The server says "not logged in" (session expired / password changed elsewhere) → back to the login page. */
function handleQueryError(error: unknown) {
  if (typeof window === "undefined") return;
  if (error instanceof Error && error.message.includes("AUTH_REQUIRED") && window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

function RootDocument() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: handleQueryError }),
        defaultOptions: {
          queries: { staleTime: 8_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning data-theme="ink" data-accent="blue" data-font="vazirmatn" data-scheme="dark">
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <PreviewHostBridge />
        <LocalSessionProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <Outlet />
              <Toaster position="top-center" dir="rtl" richColors />
            </ThemeProvider>
          </QueryClientProvider>
        </LocalSessionProvider>
        <Scripts />
      </body>
    </html>
  );
}