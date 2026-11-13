import { Champ, ChampCase, ChampChoix, ChampTexteLong } from "@/app/_composants/formulaire";

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
