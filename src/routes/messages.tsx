import { createFileRoute } from "@tanstack/react-router";
import { MessagesView } from "@/components/messages-view";
import { WorkspaceLayout } from "@/components/workspace-layout";

type Search = { to?: string };

export const Route = createFileRoute("/messages")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    to: typeof s.to === "string" ? s.to : undefined,
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { to } = Route.useSearch();
  return (
    <WorkspaceLayout>
      <MessagesView initialTo={to} />
    </WorkspaceLayout>
  );
}
