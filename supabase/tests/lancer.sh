#!/usr/bin/env bash
# Essais de la base : pour chaque fichier d'essai, crée une base vierge « tare_test »,
# y applique TOUTES les migrations dans l'ordre, puis lance l'essai.
#
#   bash supabase/tests/lancer.sh
#
# À lancer uniquement sur un Postgres local ou jetable (jamais sur un projet Supabase) :
# la base « tare_test » est supprimée et recréée à chaque essai.
# Connexion : variables habituelles de psql (PGHOST, PGPORT, PGUSER, PGPASSWORD).
set -uo pipefail
cd "$(dirname "$0")/../.."

case "${PGHOST:-localhost}" in
  localhost | 127.0.0.1 | ::1 | /*) ;;
  *)
    echo "Refusé : PGHOST=${PGHOST} n'est pas un Postgres local. Ces essais suppriment la base « tare_test »."
    exit 2
    ;;
esac

migrations=(supabase/migrations/*.sql)
essais=(supabase/tests/verrous.sql supabase/tests/cloisonnement.sql)
echecs=0

for essai in "${essais[@]}"; do
  nom=$(basename "$essai" .sql)
  echo
  echo "=== Essai « ${nom} » : base vierge + ${#migrations[@]} migration(s) ==="
  arguments=(--no-psqlrc --quiet --set ON_ERROR_STOP=1 --dbname postgres --file supabase/tests/simulation-supabase.sql)
  for migration in "${migrations[@]}"; do arguments+=(--file "$migration"); done
  arguments+=(--file "$essai")

  sortie=$(psql "${arguments[@]}" 2>&1)
  code=$?
  # On n'affiche que les lignes utiles : résultats des essais, titres et erreurs.
  echo "$sortie" | grep -E "OK |KO|ERROR|ERREUR|FATAL|^--- |FIN DES ESSAIS" | sed -E 's/^psql:[^ ]+ (NOTICE|INFO): +//'

  if [ $code -ne 0 ] || ! echo "$sortie" | grep -q "FIN DES ESSAIS" || echo "$sortie" | grep -q "KO"; then
    echecs=$((echecs + 1))
    cause=$(echo "$sortie" | grep -E "KO|ERROR|ERREUR|FATAL" | head -n 1 | sed -E 's/^psql:[^ ]+ //')
    [ -n "$cause" ] || cause="voir la sortie ci-dessus"
    echo "✖ Essai « ${nom} » en échec : ${cause}"
    # Sur GitHub : fait apparaître le message en clair à côté de la croix rouge.
    if [ -n "${GITHUB_ACTIONS:-}" ]; then
      echo "::error title=Essai de la base « ${nom} » en échec::${cause}"
    fi
  else
    echo "✔ Essai « ${nom} » réussi ($(echo "$sortie" | grep -c "OK ") vérifications)"
  fi
done

echo
if [ $echecs -ne 0 ]; then
  echo "✖ ${echecs} essai(s) de la base en échec."
  exit 1
fi
echo "✔ Tous les essais de la base sont réussis."
