"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Onglet } from "@/lib/regles";

const ONGLETS: Record<Onglet, { libelle: string; adresse: string; dessin: string }> = {
  interventions: {
    libelle: "Interventions",
    adresse: "/",
    // presse-papiers
    dessin: "M9 4h6v3H9zM7 5.5H5.5v15h13v-15H17M8.5 12h7M8.5 16h5",
  },
  parc: {
    libelle: "Parc",
    adresse: "/parc",
    // balance à plateau
    dessin: "M5 8h14l-1.5 3h-11zM12 11v3M7 20v-3.5a2.5 2.5 0 0 1 2.5-2.5h5a2.5 2.5 0 0 1 2.5 2.5V20zM4 20h16",
  },
  reglages: {
    libelle: "Réglages",
    adresse: "/reglages",
    // curseurs
    dessin: "M5 7h9M18 7h1M5 12h2M11 12h8M5 17h9M18 17h1M16 5v4M9 10v4M16 15v4",
  },
};

/** Barre d'onglets du bas. Les onglets affichés dépendent du rôle (§7). */
export function BarreOnglets({ onglets }: { onglets: Onglet[] }) {
  const chemin = usePathname();
  return (
    <nav className="onglets" aria-label="Navigation principale">
      {onglets.map((onglet) => {
        const { libelle, adresse, dessin } = ONGLETS[onglet];
        const actif = adresse === "/" ? chemin === "/" : chemin.startsWith(adresse);
        return (
          <Link key={onglet} href={adresse} className="onglet" aria-current={actif ? "page" : undefined}>
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d={dessin} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {libelle}
          </Link>
        );
      })}
    </nav>
  );
}
