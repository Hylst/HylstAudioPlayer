# À Propos de Hylst Audio Player

## 🎯 La Vision

À l'ère du streaming et des abonnements mensuels, **Hylst Audio Player** se veut un retour aux sources : la possession et la gestion de sa propre audiothèque.

L'objectif est de créer le lecteur audio web le plus rapide et le plus complet, capable de rivaliser avec les applications natives desktop (Foobar2000, MusicBee) tout en étant accessible partout via un simple navigateur ou installé comme PWA.

## 🛡️ Vie Privée & Architecture

**Privacy-First** n'est pas juste un slogan ici, c'est une architecture :
- **Pas de Tracking** : Aucun analytics tiers.
- **Pas de Serveur** : L'application est une SPA (Single Page Application) qui tourne entièrement dans votre navigateur.
- **Données Locales** : La base de données de vos musiques est stockée dans un fichier SQLite local (via OPFS). Si vous effacez les données de votre navigateur, tout disparait (sauf vos fichiers musicaux originaux évidemment).

## 💡 Philosophie de Design

- **Performance** : Utilisation intensive de Web Workers pour ne jamais bloquer l'interface.
- **Modernité** : Interface fluide (60fps), transitions soignées, bon usage du glassmorphism.
- **Robustesse** : Typage strict, gestion d'erreurs, tests unitaires.

## 👨‍💻 L'Auteur

Projet développé par **Geoffroy** dans le cadre d'une expérimentation poussée sur les capacités des Web Apps modernes (Fugu APIs).

---
*Hylst Audio Player v0.3.0*
