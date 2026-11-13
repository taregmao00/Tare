import Link from "next/link";
import { affichageVignette, formaterMois, type MoisCalendaire, type StatutMetrologie } from "@/lib/regles";

/** La vignette d'un instrument telle qu'on l'affiche partout : couleur et texte du §6.8. */
export function Vignette({
  statut,
  echeance,
  aujourdhui,
}: {
  statut: StatutMetrologie;
  echeance: MoisCalendaire | null;
  aujourdhui: string;
}) {
  const vignette = affichageVignette(statut, echeance, aujourdhui);
  return (
    <span className={`vignette vignette-${vignette.couleur}`}>
      {vignette.libelle}
      {statut === "verte" && echeance && ` (${formaterMois(echeance)})`}
    </span>
  );
}

/** Les deux vues du Parc : par client, ou tous les instruments. */
export function SousOnglets({ actif }: { actif: "clients" | "instruments" }) {
  return (
    <nav className="sous-onglets" aria-label="Vues du parc">
      <Link href="/parc" aria-current={actif === "clients" ? "page" : undefined}>
        Clients
      </Link>
      <Link href="/parc/instruments" aria-current={actif === "instruments" ? "page" : undefined}>
        Instruments
      </Link>
    </nav>
  );
}
