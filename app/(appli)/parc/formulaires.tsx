import { Champ, ChampCase, ChampChoix, ChampTexteLong } from "@/app/_composants/formulaire";
import { TYPES_INSTRUMENT_PROPOSES } from "@/lib/regles";

/** Champs d'un client, communs à la création et à la modification. */
export function ChampsClient({ agences }: { agences?: { id: string; nom: string }[] }) {
  return (
    <>
      <Champ nom="nom" libelle="Nom du client" />
      {agences && (
        <ChampChoix
          nom="agence_id"
          libelle="Agence"
          aide="L'agence ne pourra plus être changée ensuite."
          choix={agences.map((a) => ({ valeur: a.id, libelle: a.nom }))}
        />
      )}
      <ChampCase
        nom="critique"
        libelle="Client critique"
        aide="Ses demandes seront urgentes par défaut (exemple : une seule balance, activité à l'arrêt en cas de panne)."
      />
      <ChampTexteLong nom="note" libelle="Note" facultatif aide="Exemple : un seul pont-bascule, expéditions à l'arrêt." />
    </>
  );
}

/** Champs d'un site, communs à la création et à la modification. */
export function ChampsSite() {
  return (
    <>
      <Champ nom="nom" libelle="Nom du site" aide="Exemple : Magasin centre-ville, Cave de réception." />
      <ChampTexteLong nom="adresse" libelle="Adresse" facultatif />
      <Champ
        nom="distance_km"
        libelle="Distance depuis l'agence (km, aller)"
        inputMode="numeric"
        aide="En kilomètres entiers. Elle fixe le forfait de déplacement."
      />
      <Champ nom="contact_nom" libelle="Contact sur place" facultatif />
      <Champ nom="contact_fonction" libelle="Fonction du contact" facultatif />
      <Champ nom="contact_telephone" libelle="Téléphone" type="tel" inputMode="tel" facultatif />
      <Champ
        nom="contact_email"
        libelle="Email"
        type="email"
        inputMode="email"
        facultatif
        aide="Le bon signé sera envoyé à cette adresse (modifiable sur le bon)."
      />
    </>
  );
}

/** Champs de la fiche d'un instrument, communs à la création et à la modification. */
export function ChampsFicheInstrument() {
  return (
    <>
      <Champ
        nom="type"
        libelle="Type d'instrument"
        suggestions={TYPES_INSTRUMENT_PROPOSES}
        aide="Choisissez dans la liste proposée ou écrivez le vôtre."
      />
      <div className="deux-colonnes">
        <Champ nom="marque" libelle="Marque" />
        <Champ nom="modele" libelle="Modèle" />
      </div>
      <Champ nom="numero_serie" libelle="N° de série" aide="Tel qu'il est gravé sur la plaque de l'instrument." />
      <div className="deux-colonnes">
        <Champ nom="portee_max" libelle="Portée (Max)" aide="Exemple : 15 kg" />
        <Champ nom="echelon" libelle="Échelon (e)" aide="Exemple : 5 g" />
      </div>
      <Champ nom="millesime" libelle="Millésime" inputMode="numeric" facultatif aide="Année sur 4 chiffres." />
      <Champ nom="emplacement" libelle="Emplacement" facultatif aide="Exemple : Étal fruits, Quai de réception." />
    </>
  );
}
