# Correcteur IA Français - Extension Chrome

Extension Chrome pour la correction orthographique et grammaticale en temps réel en français, utilisant l'intelligence artificielle via les modèles Hugging Face.

## ✨ Fonctionnalités

- **Correction en temps réel** : Détection automatique des erreurs pendant la saisie
- **IA française** : Utilise des modèles spécialisés pour le français (CamemBERT, FlauBERT)
- **Interface intuitive** : Suggestions contextuelles avec popup
- **Personnalisable** : Réglage du seuil de confiance et choix du modèle
- **Statistiques** : Suivi de vos corrections et améliorations
- **Raccourcis clavier** : Navigation rapide et efficace

## 🚀 Installation

### 1. Préparation des fichiers

Créez un dossier `correcteur-ia-chrome` et placez-y les fichiers suivants :

```
correcteur-ia-chrome/
├── manifest.json
├── content.js
├── background.js
├── styles.css
├── popup.html
└── README.md
```

### 2. Obtenir un token Hugging Face

1. Allez sur [huggingface.co](https://huggingface.co)
2. Créez un compte gratuit
3. Allez dans **Settings** > **Access Tokens**
4. Créez un nouveau token avec les permissions de lecture
5. Copiez le token (format : `hf_xxxxxxxxxxxxxxxxxxxx`)

### 3. Installation dans Chrome

1. Ouvrez Chrome et allez dans `chrome://extensions/`
2. Activez le **Mode développeur** (en haut à droite)
3. Cliquez sur **Charger l'extension non empaquetée**
4. Sélectionnez le dossier `correcteur-ia-chrome`
5. L'extension devrait apparaître dans votre liste d'extensions

### 4. Configuration

1. Cliquez sur l'icône de l'extension dans la barre d'outils
2. Collez votre token Hugging Face dans le champ dédié
3. Choisissez votre modèle préféré (CamemBERT recommandé)
4. Ajustez le seuil de confiance selon vos préférences
5. Cliquez sur **Tester la connexion** pour vérifier
6. Sauvegardez les paramètres

## 🔧 Configuration avancée

### Modèles disponibles

- **CamemBERT** (Recommandé) : Modèle BERT français optimisé
- **FlauBERT** : Alternative performante pour diverses tâches NLP  
- **OPUS-MT** : Spécialisé dans la traduction français-français

### Paramètres de performance

- **Seuil de confiance** : 50-95% (70% recommandé)
  - Plus élevé = moins de suggestions mais plus précises
  - Plus bas = plus de suggestions mais possibles faux positifs

### Personnalisation du code

Pour adapter l'extension à vos besoins spécifiques :

#### Modifier les modèles utilisés

Dans `background.js`, section `modelEndpoints` :

```javascript
const modelEndpoints = {
    votre_modele: 'https://api-inference.huggingface.co/models/votre-organisation/votre-modele',
    // Ajoutez vos modèles personnalisés
};
```

#### Changer la logique de détection

Dans `content.js`, fonction `handleInput` :

```javascript
this.debounceTimer = setTimeout(() => {
    this.analyzeText(event.target);
}, 300); // Réduire le délai pour plus de réactivité
```

#### Personnaliser l'apparence

Modifiez `styles.css` pour adapter l'interface :

```css
.error-underline {
    /* Changez la couleur des soulignements d'erreur */
    background: repeating-linear-gradient(/* vos couleurs */);
}
```

## 📊 Utilisation

### Interface utilisateur

1. **Toggle flottant** : Activez/désactivez le correcteur (coin inférieur droit)
2. **Soulignements colorés** : 
   - Rouge : Erreurs d'orthographe
   - Bleu : Erreurs de grammaire
   - Orange : Suggestions de style
3. **Popups de correction** : Cliquez sur un soulignement pour voir les suggestions

### Raccourcis clavier

- `Ctrl + Shift + C` : Activer/désactiver le correcteur
- `Ctrl + Shift + A` : Accepter la suggestion active
- `Escape` : Fermer toutes les popups

### Zones de texte supportées

- Champs de saisie HTML (`<input>`, `<textarea>`)
- Éléments avec `contentEditable="true"`
- Zones de texte des principales applications web

## 🔍 Résolution de problèmes

### Erreurs courantes

**"Token Hugging Face requis"**
- Vérifiez que votre token est correctement configuré
- Assurez-vous qu'il n'a pas expiré

**"Modèle en cours de chargement"**
- Les modèles Hugging Face peuvent prendre quelques secondes à démarrer
- Réessayez après quelques instants

**"Erreur de connexion"**
- Vérifiez votre connexion internet
- Contrôlez que Hugging Face n'est pas bloqué par votre pare-feu

### Optimisation des performances

1. **Réduire la fréquence** : Augmentez le délai dans `handleInput`
2. **Filtrer par longueur** : Modifiez la condition `text.length < 10`
3. **Cache local** : Implémentez un système de cache pour les corrections fréquentes

### Debugging

Ouvrez les **Outils de développement** (F12) et consultez :

- **Console** : Messages d'erreur et de debug
- **Network** : Requêtes vers l'API Hugging Face
- **Storage** : Paramètres et statistiques stockés

## 🚀 Développement et contribution

### Structure du code

- `manifest.json` : Configuration de l'extension
- `content.js` : Script principal injecté dans les pages
- `background.js` : Service worker pour les requêtes API
- `popup.html/js` : Interface de configuration
- `styles.css` : Styles pour l'interface de correction

### API et intégrations

L'extension utilise :

- **Hugging Face Inference API** : Pour les modèles de correction
- **Chrome Storage API** : Pour la persistance des paramètres
- **Chrome Runtime API** : Pour la communication entre scripts

### Extensions possibles

- Support d'autres langues
- Intégration avec des services de correction premium
- Correction par lot de textes longs
- Apprentissage personnalisé basé sur vos corrections

## 📝 Licence et support

Cette extension est fournie à des fins éducatives et de démonstration. 

Pour le support technique :
- Consultez la documentation Hugging Face
- Vérifiez les logs de la console Chrome
- Testez avec différents modèles selon vos besoins

## 🔄 Mises à jour

Pour mettre à jour l'extension :

1. Remplacez les fichiers dans le dossier d'extension
2. Allez dans `chrome://extensions/`
3. Cliquez sur le bouton de rechargement de l'extension
4. Vos paramètres et statistiques seront conservés

---

**Note importante** : Cette extension nécessite un token Hugging Face valide et une connexion internet pour fonctionner. Les corrections sont traitées en ligne via l'API Hugging Face.
