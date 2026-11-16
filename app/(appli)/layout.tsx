import { Suspense } from "react";
import { BarreOnglets } from "@/app/_composants/navigation";
import { ongletsPour } from "@/lib/regles";
import { session } from "@/lib/supabase/utilisateur-courant";

/** Cadre commun aux écrans de l'appli : en-tête, contenu, barre d'onglets du bas. */
export default function CadreAppli({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="entete">
        <div className="entete-contenu">
          <span className="titre-appli">Tare</span>
          <Suspense>
            <Identite />
          </Suspense>
        </div>
      </header>
      {/* Chaque écran attend ses données derrière son propre « Ecran » (message « Chargement… »). */}
      <main className="page">{children}</main>
      <Suspense>
        <Onglets />
      </Suspense>
    </>
  );
}

async function Identite() {
  const { utilisateur } = await session();
  if (utilisateur === null || utilisateur === "sans_fiche") return null;
  return (
    <span className="identite">
      <strong>{utilisateur.nom}</strong>
      <span className="discret">{utilisateur.agence ?? "Toutes les agences"}</span>
    </span>
  );
}

async function Onglets() {
  const { utilisateur } = await session();
  // Compte inutilisable : seul l'onglet Réglages reste, pour pouvoir se déconnecter.
  const onglets = utilisateur === null || utilisateur === "sans_fiche" ? ["reglages" as const] : ongletsPour(utilisateur.role);
  return <BarreOnglets onglets={onglets} />;
}
