/**
 * Lecture d'un fichier CSV (tableau enregistré en texte, une ligne par enregistrement).
 * Fonctions pures, sans dépendance : servent à l'import des instruments, puis à celui du catalogue.
 *
 * Tolérances voulues, car les fichiers viennent d'Excel ou de LibreOffice :
 *   - séparateur « ; » (Excel en français), « , » ou tabulation : deviné sur la première ligne ;
 *   - cellules entre guillemets, avec « "" » pour un guillemet dans le texte ;
 *   - fins de ligne Windows ou Unix, lignes vides ignorées ;
 *   - accents en UTF-8 ou dans l'ancien codage de Windows (Windows-1252).
 */

export interface LigneCsv {
  /** Numéro de la ligne dans le fichier (1 = première ligne), pour désigner une erreur. */
  numero: number;
  cellules: string[];
}

export type LectureCsv = { ok: true; lignes: LigneCsv[] } | { ok: false; erreur: string };

/** Transforme les octets d'un fichier en texte, en devinant le codage des accents. */
export function decoderFichier(octets: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(octets);
  } catch {
    // Pas de l'UTF-8 valide : c'est presque toujours un fichier enregistré par un vieil Excel.
    return new TextDecoder("windows-1252").decode(octets);
  }
}

/** Le séparateur le plus fréquent sur la première ligne, hors guillemets (« ; » par défaut). */
function devinerSeparateur(texte: string): string {
  const compte: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
  let entreGuillemets = false;
  for (const c of texte) {
    if (c === '"') entreGuillemets = !entreGuillemets;
    else if (!entreGuillemets && (c === "\n" || c === "\r")) break;
    else if (!entreGuillemets && c in compte) compte[c]++;
  }
  return compte["\t"] > compte[";"] && compte["\t"] > compte[","] ? "\t" : compte[","] > compte[";"] ? "," : ";";
}

export function lireCsv(contenu: string): LectureCsv {
  // Excel ajoute parfois un caractère invisible en tout début de fichier.
  const texte = contenu.replace(/^﻿/, "");
  const separateur = devinerSeparateur(texte);

  const lignes: LigneCsv[] = [];
  let cellules: string[] = [];
  let cellule = "";
  let entreGuillemets = false;
  let ligneCourante = 1;
  let ligneDebut = 1;
  let ligneGuillemet = 0;

  const finirLigne = () => {
    cellules.push(cellule.trim());
    if (cellules.some((c) => c !== "")) lignes.push({ numero: ligneDebut, cellules });
    cellules = [];
    cellule = "";
  };

  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (entreGuillemets) {
      if (c === '"' && texte[i + 1] === '"') {
        cellule += '"';
        i++;
      } else if (c === '"') {
        entreGuillemets = false;
      } else {
        if (c === "\n") ligneCourante++;
        cellule += c;
      }
    } else if (c === '"' && cellule.trim() === "") {
      entreGuillemets = true;
      ligneGuillemet = ligneCourante;
      cellule = "";
    } else if (c === separateur) {
      cellules.push(cellule.trim());
      cellule = "";
    } else if (c === "\n") {
      finirLigne();
      ligneCourante++;
      ligneDebut = ligneCourante;
    } else if (c !== "\r") {
      cellule += c;
    }
  }
  if (entreGuillemets) {
    return { ok: false, erreur: `Ligne ${ligneGuillemet} : un guillemet est ouvert et jamais refermé. Le fichier ne peut pas être lu.` };
  }
  finirLigne();
  return { ok: true, lignes };
}
