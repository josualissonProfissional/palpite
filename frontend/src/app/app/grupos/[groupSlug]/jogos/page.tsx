import { redirect } from "next/navigation";

// Pagina de jogos consolidada no resumo do grupo (/app/grupos/{slug}).
// Mantemos a rota apenas como redirecionamento para links antigos.
export default async function MatchesPage({
  params,
}: {
  params: Promise<{ groupSlug: string }>;
}) {
  const { groupSlug } = await params;
  redirect(`/app/grupos/${groupSlug}`);
}
