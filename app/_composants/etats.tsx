import Link from "next/link";
import { Suspense, type ReactNode } from "react";

/**
 * Enveloppe de chaque écran : pendant qu'il lit ses données dans la base, l'en-tête et les
 * onglets restent en place et le contenu affiche « Chargement… ».
 * À mettre dans chaque page, autour de la partie qui lit la base (Next le réclame pour que
 * le changement d'écran soit immédiat).
 */
export function Ecran({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p className="discret">Chargement…</p>}>{children}</Suspense>;
}

/** Message affiché quand une lecture de la base échoue. Le détail technique va dans le terminal du serveur. */
export function ErreurLecture({ quoi, code, detail }: { quoi: string; code: string; detail: string }) {
  console.error(`[lecture] ${quoi} : impossible (${code}) : ${detail}`);
  return (
    <p className="erreur" role="alert">
      {quoi} : lecture impossible.{" "}
      {code === "42501"
        ? "La base de données n'est pas à jour : prévenez l'administrateur."
        : "Vérifiez le réseau et rechargez la page ; si cela dure, prévenez l'administrateur."}{" "}
      <span className="discret">(code {code})</span>
    </p>
  );
}

/** Compte connecté mais inutilisable (pas de fiche, ou désactivé), ou personne de connecté. */
export function SansAcces({ connecte }: { connecte: boolean }) {
  return connecte ? (
    <p className="erreur" role="alert">
      Votre compte n&apos;est rattaché à aucune entreprise, ou il est désactivé. Contactez l&apos;administrateur de votre
      entreprise.
    </p>
  ) : (
    <p>
      Vous n&apos;êtes pas connecté. <Link href="/connexion">Se connecter</Link>
    </p>
  );
}

/** Lien « retour » en haut d'un écran de détail ou d'un formulaire. */
export function Retour({ vers, children }: { vers: string; children: ReactNode }) {
  return (
    <Link href={vers} className="retour">
      ‹ {children}
    </Link>
  );
}

/** Liste vide : toujours un message explicite (§7). */
export function Vide({ children }: { children: ReactNode }) {
  return <p className="vide">{children}</p>;
}
