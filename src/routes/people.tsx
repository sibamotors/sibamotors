import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PeopleView } from "@/components/people-view";
import { WorkspaceLayout } from "@/components/workspace-layout";
import { deletePerson, listPeople, upsertPerson } from "@/lib/local-db";
import { listLocalUsers } from "@/lib/local-users";
import { useLocalSession } from "@/lib/local-session";

export const Route = createFileRoute("/people")({ component: PeoplePage });

function PeoplePage() {
  const qc = useQueryClient();
  const { isAdmin } = useLocalSession();
  const q = useQuery({ queryKey: ["people"], queryFn: () => listPeople() });
  const dirQ = useQuery({ queryKey: ["local-users"], queryFn: () => listLocalUsers() });
  const saveMut = useMutation({
    mutationFn: (data: {
      id?: string;
      code: string;
      firstName: string;
      lastName: string;
      role: string;
      username?: string;
    }) => upsertPerson({ data }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["people"] });
      void qc.invalidateQueries({ queryKey: ["board"] });
    },
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deletePerson({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["people"] });
      void qc.invalidateQueries({ queryKey: ["board"] });
    },
  });

  return (
    <WorkspaceLayout>
      {q.isLoading ? (
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="h-2 w-40 overflow-hidden rounded-full bg-surface">
            <div className="k-skeleton h-full w-full" />
          </div>
        </div>
      ) : (
        <PeopleView
          people={q.data ?? []}
          canEdit={isAdmin}
          directory={dirQ.data ?? []}
          onSave={(p) => saveMut.mutate(p)}
          onDelete={(id) => delMut.mutate(id)}
        />
      )}
    </WorkspaceLayout>
  );
}
