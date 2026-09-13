# UNAL Market · Armentières — Menu digital

Site vitrine statique présentant le menu d'UNAL MARKET à Armentières :
sandwichs, burgers, pâtes et tacos.

## Contenu

- `/` — page d'accueil
- `/menu` — la carte complète (5 catégories)
- `/affichage` — mode d'affichage pour les écrans du magasin
- `/informations-legales` — informations légales

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
