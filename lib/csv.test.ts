import { describe, expect, it } from "vitest";
import { decoderFichier, lireCsv } from "./csv";

const cellules = (contenu: string) => {
  const lecture = lireCsv(contenu);
  if (!lecture.ok) throw new Error(lecture.erreur);
  return lecture.lignes.map((l) => l.cellules);
};

describe("lecture d'un CSV", () => {
  it("lit un fichier Excel français : point-virgule, fins de ligne Windows, caractère invisible au début", () => {
    expect(cellules("﻿client;type\r\nPrimeurs Dubois;Balance\r\n")).toEqual([
      ["client", "type"],
      ["Primeurs Dubois", "Balance"],
    ]);
  });

  it("devine la virgule ou la tabulation", () => {
    expect(cellules("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
    expect(cellules("a\tb\n1\t2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("garde le séparateur et les guillemets placés entre guillemets", () => {
    expect(cellules('nom;note\n"Dubois; fils";"Dit ""le primeur"""')).toEqual([
      ["nom", "note"],
      ["Dubois; fils", 'Dit "le primeur"'],
    ]);
  });

  it("retire les espaces autour des cellules et garde les cellules vides", () => {
    expect(cellules("a;b;c\n  x ;; z ")).toEqual([
      ["a", "b", "c"],
      ["x", "", "z"],
    ]);
  });

  it("ignore les lignes vides mais garde le vrai numéro de ligne du fichier", () => {
    const lecture = lireCsv("a;b\n\n;;\n1;2\n");
    expect(lecture).toEqual({
      ok: true,
      lignes: [
        { numero: 1, cellules: ["a", "b"] },
        { numero: 4, cellules: ["1", "2"] },
      ],
    });
  });

  it("compte les lignes même quand une cellule contient un retour à la ligne", () => {
    const lecture = lireCsv('a;b\n"deux\nlignes";x\n1;2');
    expect(lecture.ok && lecture.lignes.map((l) => l.numero)).toEqual([1, 2, 4]);
  });

  it("refuse un guillemet jamais refermé, en donnant la ligne", () => {
    const lecture = lireCsv('a;b\n1;"oubli\n3;4');
    expect(lecture.ok).toBe(false);
    if (!lecture.ok) expect(lecture.erreur).toContain("Ligne 2");
  });

  it("fichier vide : aucune ligne", () => {
    expect(cellules("")).toEqual([]);
    expect(cellules("\n\r\n")).toEqual([]);
  });
});

describe("codage des accents", () => {
  it("lit l'UTF-8", () => {
    expect(decoderFichier(new TextEncoder().encode("Carrière"))).toBe("Carrière");
  });

  it("lit l'ancien codage de Windows (fichier enregistré par Excel)", () => {
    // « Carrière » : le è vaut l'octet E8 en Windows-1252, ce qui n'est pas de l'UTF-8 valide.
    expect(decoderFichier(new Uint8Array([0x43, 0x61, 0x72, 0x72, 0x69, 0xe8, 0x72, 0x65]))).toBe("Carrière");
  });
});
