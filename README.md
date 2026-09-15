# UNAL Market · Armentières — Menu digital

Site vitrine statique présentant le menu d'UNAL MARKET à Armentières :
sandwichs, burgers, pâtes et tacos.

## Contenu

- `/` — page d'accueil (galerie photos, accès à la carte, statut d'ouverture)
- `/menu` — la carte complète (5 catégories)
- `/informations-legales` — informations légales

## Accessibilité & référencement

- Les vignettes de la galerie sont de vrais boutons (clavier, tactile,
  lecteur d'écran), la lightbox gère le focus et se ferme avec Échap.
- La carte plein écran et la carte qui alimente l'écran du téléphone sont
  retirées de l'ordre de tabulation quand elles ne sont pas visibles
  (`inert` + `aria-hidden`).
- `seo.js` aligne titre, description et URL canonique sur la route courante ;
  les données structurées (`Restaurant`), les balises Open Graph, `robots.txt`
  et `sitemap.xml` sont statiques dans `index.html` / à la racine.
- `open-status.js` calcule le statut « ouvert / fermé » en heure de Paris et
  réécrit le segment d'horaires du ruban en conséquence.

Site 100 % statique : aucune donnée n'est envoyée à un serveur.

## Technique

Site 100 % statique (build Vite d'une application React) : **aucun backend,
aucune base de données, aucune variable d'environnement**. Toutes les données
du menu sont intégrées dans les fichiers du site.

## Déployer sur Vercel

Le déploiement se fait en un clic depuis ce dépôt (framework « Other »,
aucun paramètre à renseigner) ou en ligne de commande :

```bash
npm i -g vercel
vercel --prod
```

`vercel.json` fournit déjà la configuration nécessaire (rewrites SPA et
cache des assets).

## Développement local

Aucune installation nécessaire — servez simplement les fichiers :

```bash
npx serve .        # ou n'importe quel serveur statique
```
