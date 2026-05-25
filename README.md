# Status Board Personnel — version web GitHub Pages

Version **page web** du tableau de surveillance SaaS, dérivée de l’extension Chrome v1.1.8.

Elle sert à comparer les deux approches avant de choisir entre :

- une page accessible par URL ;
- une extension Chrome publiée sur le Chrome Web Store.

## Ce que cette version reprend

- affichage **Tableau** ou **Cartes** ;
- densités Confortable, Compacte et Très compacte ;
- tri alphabétique ou incidents d’abord ;
- filtre persistant « Afficher seulement les alertes » ;
- ajout, modification et suppression de services ;
- détection du type de page de statut ;
- import / export JSON, compatible avec la configuration de l’extension ;
- palette et bordures de la version extension v2.8.

## Différences importantes avec l’extension Chrome

| Sujet | Page GitHub Pages | Extension Chrome |
|---|---|---|
| Accès | URL accessible immédiatement | Installation préalable |
| Mise à jour du code | Immédiate après publication | Mise à jour de l’extension |
| Données pour l’instant | `localStorage` du navigateur | `chrome.storage.sync` / `local` |
| Requêtes vers les statuts | CORS : proxy de secours nécessaire pour certains services | Accès direct grâce aux permissions de l’extension |
| Vérifications automatiques | Tant que la page est ouverte | Worker / alarmes de l’extension |
| Notifications | Tant que la page est ouverte | Peut fonctionner via l’extension en arrière-plan |

Cette version n’intègre volontairement **pas encore Supabase**. Une fois l’approche choisie, la synchronisation multi-sessions pourra être ajoutée à la version retenue.

## Proxy CORS

Une page web ne peut pas toujours interroger directement des domaines tiers. La version GitHub Pages utilise donc :

1. un appel direct ;
2. en cas d’échec, un proxy CORS configurable dans **Réglages**.

Par défaut, le proxy est prérempli avec :

```text
https://corsproxy.io/?
```

C’est adapté à une comparaison ou à un usage personnel ponctuel. Pour un usage durable, il faudra envisager un proxy que tu contrôles, ou retenir l’extension Chrome.

## Publier sur GitHub Pages

1. Créer un nouveau dépôt GitHub, par exemple `status-board-web`.
2. Décompresser l’archive et placer **le contenu** de ce dossier à la racine du dépôt.
3. Commit / push sur la branche `main`.
4. Dans le dépôt : **Settings > Pages**.
5. Choisir **Deploy from a branch**, puis `main` et `/ (root)`.
6. Ouvrir l’URL GitHub Pages indiquée une fois le déploiement terminé.

Le fichier `index.html` se trouve déjà à la racine et le fichier `.nojekyll` évite un traitement inutile par Jekyll.

## Tester localement avant publication

Les modules JavaScript ne doivent pas être ouverts via `file://`. Depuis le dossier du projet :

```bash
python -m http.server 8080
```

Puis ouvrir :

```text
http://localhost:8080
```

## Importer la configuration de l’extension

Dans l’extension :

1. Cliquer sur **Exporter**.
2. Dans cette page web, cliquer sur **Importer**.
3. Sélectionner le fichier JSON exporté.

La liste des services et les préférences d’affichage sont reprises. Elles restent locales au navigateur tant que la synchronisation Supabase n’est pas développée.

## Structure du projet

```text
index.html
styles/dashboard.css
js/dashboard.js
src/
  web-app.js
  storage.js
  detector.js
  status-engine.js
  utils.js
  defaults.js
  providers/
icons/
tests/
```

## Tests des parseurs

```bash
npm test
```

Ces tests couvrent les parseurs et l’auto-détection hérités de l’extension. Les différences navigateur liées au CORS doivent être testées dans la page publiée ou servie localement.
