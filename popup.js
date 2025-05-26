// Script pour la popup de configuration

// Variables globales
let settings = {};
let isInitialized = false;
let eventListenersAdded = false; // Éviter la duplication d'événements

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup DOM chargé');

    // Éviter l'initialisation multiple
    if (isInitialized) {
        console.log('Popup déjà initialisé, ignoré');
        return;
    }

    loadSettings();
    initializeEventListeners();
    loadStatistics();
});

// Chargement des paramètres
function loadSettings() {
    chrome.storage.sync.get(null, function(result) {
        settings = {
            correctorEnabled: result.correctorEnabled ?? true,
            correctionModel: result.correctionModel ?? 'camembert',
            hfToken: result.hfToken ?? '',
            confidenceThreshold: result.confidenceThreshold ?? 0.7,
            maxSuggestions: result.maxSuggestions ?? 3
        };

        updateUI();
        isInitialized = true;
        console.log('Paramètres chargés:', settings);
    });
}

// Mise à jour de l'interface
function updateUI() {
    const enableToggle = document.getElementById('enableToggle');
    const modelSelect = document.getElementById('modelSelect');
    const hfToken = document.getElementById('hfToken');
    const confidenceSlider = document.getElementById('confidenceSlider');
    const confidenceValue = document.getElementById('confidenceValue');

    if (!enableToggle || !modelSelect || !hfToken || !confidenceSlider || !confidenceValue) {
        console.error('Éléments DOM manquants');
        return;
    }

    // Toggle principal
    if (settings.correctorEnabled) {
        enableToggle.classList.add('active');
    } else {
        enableToggle.classList.remove('active');
    }

    // Sélection du modèle - OPTIONS CORRIGÉES
    modelSelect.innerHTML = `
        <option value="camembert">CamemBERT (Recommandé)</option>
        <option value="flaubert">FlauBERT</option>
        <option value="barthez">BARThez</option>
        <option value="gpt2_french">GPT-2 Français</option>
    `;

    modelSelect.value = settings.correctionModel;
    updateModelInfo(settings.correctionModel);

    // Token HF
    hfToken.value = settings.hfToken;

    // Seuil de confiance
    confidenceSlider.value = Math.round(settings.confidenceThreshold * 100);
    confidenceValue.textContent = Math.round(settings.confidenceThreshold * 100) + '%';
}

// Informations sur les modèles - MISES À JOUR
function updateModelInfo(model) {
    const modelInfo = document.getElementById('modelInfo');
    const infos = {
        camembert: 'CamemBERT : Modèle BERT français optimisé (le plus fiable)',
        flaubert: 'FlauBERT : Alternative française performante pour diverses tâches NLP',
        barthez: 'BARThez : Modèle de génération de texte français (BART)',
        gpt2_french: 'GPT-2 Français : Modèle génératif pour la correction de texte'
    };
    if (modelInfo) {
        modelInfo.textContent = infos[model] || infos.camembert;
    }
}

// Initialisation des événements - ÉVITER LA DUPLICATION
function initializeEventListeners() {
    if (eventListenersAdded) {
        console.log('Event listeners déjà ajoutés');
        return;
    }

    console.log('Ajout des event listeners');

    // Toggle principal
    const enableToggle = document.getElementById('enableToggle');
    if (enableToggle) {
        enableToggle.addEventListener('click', function() {
            settings.correctorEnabled = !settings.correctorEnabled;
            this.classList.toggle('active');
            saveSettings();
        });
    }

    // Sélection du modèle
    const modelSelect = document.getElementById('modelSelect');
    if (modelSelect) {
        modelSelect.addEventListener('change', function() {
            settings.correctionModel = this.value;
            updateModelInfo(this.value);
            saveSettings();
        });
    }

    // Token HF
    const hfToken = document.getElementById('hfToken');
    if (hfToken) {
        hfToken.addEventListener('input', function() {
            settings.hfToken = this.value.trim();
            // Sauvegarde automatique après 1 seconde
            clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => saveSettings(), 1000);
        });
    }

    // Seuil de confiance
    const confidenceSlider = document.getElementById('confidenceSlider');
    const confidenceValue = document.getElementById('confidenceValue');
    if (confidenceSlider && confidenceValue) {
        confidenceSlider.addEventListener('input', function() {
            settings.confidenceThreshold = this.value / 100;
            confidenceValue.textContent = this.value + '%';
            clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => saveSettings(), 500);
        });
    }

    // Boutons d'action
    const saveButton = document.getElementById('saveSettings');
    const testButton = document.getElementById('testConnection');
    const resetButton = document.getElementById('resetSettings');

    if (saveButton) saveButton.addEventListener('click', saveSettings);
    if (testButton) testButton.addEventListener('click', testConnection);
    if (resetButton) resetButton.addEventListener('click', resetSettings);

    eventListenersAdded = true;
}

// Sauvegarde des paramètres
function saveSettings() {
    if (!isInitialized) return;

    chrome.storage.sync.set(settings, function() {
        if (chrome.runtime.lastError) {
            console.error('Erreur sauvegarde:', chrome.runtime.lastError);
            showStatus('Erreur lors de la sauvegarde', 'error');
            return;
        }

        showStatus('Paramètres sauvegardés avec succès', 'success');
        console.log('Paramètres sauvegardés:', settings);

        // Notifier les content scripts
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'settingsUpdated',
                    settings: settings
                }).catch(err => {
                    // Ignore les erreurs de message (page non compatible)
                    console.log('Message non envoyé (normal):', err.message);
                });
            }
        });
    });
}

// Test de connexion API - AVEC URL CORRIGÉE
async function testConnection() {
    if (!settings.hfToken || settings.hfToken.trim() === '') {
        showStatus('Token Hugging Face requis pour tester la connexion', 'error');
        return;
    }

    showStatus('Test de connexion en cours...', 'success');

    // URLs corrigées
    const testUrls = {
        camembert: 'https://api-inference.huggingface.co/models/camembert-base',
        flaubert: 'https://api-inference.huggingface.co/models/flaubert/flaubert_base_cased',
        barthez: 'https://api-inference.huggingface.co/models/moussaKam/barthez',
        gpt2_french: 'https://api-inference.huggingface.co/models/gilf/french-gpt-2'
    };

    const testUrl = testUrls[settings.correctionModel] || testUrls.camembert;

    console.log('Test connexion vers:', testUrl);

    try {
        const response = await fetch(testUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.hfToken.trim()}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: "Test de connexion",
                options: {
                    wait_for_model: false,
                    use_cache: false
                }
            })
        });

        console.log('Réponse test:', response.status);

        if (response.ok) {
            showStatus('✅ Connexion réussie ! Le correcteur est opérationnel', 'success');
        } else if (response.status === 401) {
            showStatus('❌ Token invalide. Vérifiez votre token Hugging Face', 'error');
        } else if (response.status === 404) {
            showStatus('❌ Modèle non trouvé. Essayez un autre modèle.', 'error');
        } else if (response.status === 503) {
            showStatus('⏳ Modèle en cours de chargement. Réessayez dans 10 secondes', 'success');
        } else {
            showStatus(`❌ Erreur ${response.status}: ${response.statusText}`, 'error');
        }
    } catch (error) {
        console.error('Erreur test connexion:', error);
        showStatus('❌ Erreur de connexion. Vérifiez votre connexion internet', 'error');
    }
}

// Réinitialisation des paramètres
function resetSettings() {
    if (confirm('Voulez-vous vraiment réinitialiser tous les paramètres ?')) {
        chrome.storage.sync.clear(function() {
            chrome.storage.local.clear(function() {
                // Recharger les paramètres par défaut
                isInitialized = false;
                loadSettings();
                showStatus('Paramètres réinitialisés', 'success');
            });
        });
    }
}

// Affichage des messages de statut
function showStatus(message, type) {
    const statusElement = document.getElementById('statusMessage');
    if (!statusElement) return;

    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
    statusElement.style.display = 'block';

    setTimeout(() => {
        statusElement.style.display = 'none';
    }, 4000);
}

// Chargement des statistiques
function loadStatistics() {
    chrome.storage.local.get(['stats'], function(result) {
        const stats = result.stats || {
            correctionsCount: 0,
            acceptedCount: 0,
            ignoredCount: 0
        };

        const correctionsCount = document.getElementById('correctionsCount');
        const acceptedCount = document.getElementById('acceptedCount');
        const ignoredCount = document.getElementById('ignoredCount');

        if (correctionsCount) correctionsCount.textContent = stats.correctionsCount;
        if (acceptedCount) acceptedCount.textContent = stats.acceptedCount;
        if (ignoredCount) ignoredCount.textContent = stats.ignoredCount;
    });
}

// Raccourcis clavier
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        const enableToggle = document.getElementById('enableToggle');
        if (enableToggle) enableToggle.click();
    }
});
