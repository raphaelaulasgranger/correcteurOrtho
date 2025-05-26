// Service Worker pour le module Chrome de correction orthographique

// Initialisation lors de l'installation
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Correcteur IA Français installé');

    // Initialiser les paramètres par défaut
    chrome.storage.sync.set({
        correctorEnabled: true,
        correctionModel: 'camembert',
        confidenceThreshold: 0.7,
        maxSuggestions: 3,
        hfToken: ''
    }).then(() => {
        console.log('Paramètres par défaut initialisés');
    }).catch((error) => {
        console.error('Erreur lors de l\'initialisation:', error);
    });
});

// Gestion des messages entre les scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message reçu:', request.action);

    switch (request.action) {
        case 'getCorrections':
            handleCorrectionRequest(request.text)
            .then(corrections => {
                sendResponse({ success: true, corrections });
            })
            .catch(error => {
                console.error('Erreur correction:', error);
                sendResponse({ success: false, error: error.message });
            });
            return true; // Indique une réponse asynchrone

        case 'updateSettings':
            chrome.storage.sync.set(request.settings)
            .then(() => {
                sendResponse({ success: true });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;

        case 'getSettings':
            chrome.storage.sync.get(null)
            .then(settings => {
                sendResponse({ success: true, settings });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;

        default:
            sendResponse({ success: false, error: 'Action non reconnue' });
            return false;
    }
});

// Fonction principale de correction via API
async function handleCorrectionRequest(text) {
    try {
        const settings = await getStoredSettings();

        if (!settings.hfToken || settings.hfToken === '') {
            throw new Error('Token Hugging Face requis');
        }

        const corrections = await getCorrectionsFromAPI(text, settings);
        return corrections;
    } catch (error) {
        console.error('Erreur lors de la correction:', error);
        throw error;
    }
}

// Récupération des paramètres stockés
async function getStoredSettings() {
    try {
        const settings = await chrome.storage.sync.get(null);
        return {
            correctorEnabled: settings.correctorEnabled ?? true,
            correctionModel: settings.correctionModel ?? 'camembert',
            hfToken: settings.hfToken ?? '',
            confidenceThreshold: settings.confidenceThreshold ?? 0.7,
            maxSuggestions: settings.maxSuggestions ?? 3
        };
    } catch (error) {
        console.error('Erreur récupération paramètres:', error);
        throw error;
    }
}

// API de correction avec différents modèles
async function getCorrectionsFromAPI(text, settings) {
    const modelEndpoints = {
        camembert: 'https://api-inference.huggingface.co/models/camembert/camembert-base',
        flaubert: 'https://api-inference.huggingface.co/models/flaubert/flaubert_base_cased',
        opus: 'https://api-inference.huggingface.co/models/Helsinki-NLP/opus-mt-fr-fr'
    };

    const apiUrl = modelEndpoints[settings.correctionModel] || modelEndpoints.camembert;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.hfToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: text,
                options: {
                    wait_for_model: true,
                    use_cache: true
                }
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Token Hugging Face invalide');
            } else if (response.status === 503) {
                throw new Error('Modèle en cours de chargement, veuillez réessayer');
            } else {
                throw new Error(`Erreur API: ${response.status} - ${response.statusText}`);
            }
        }

        const result = await response.json();
        return parseModelResponse(result, text, settings);

    } catch (error) {
        if (error.name === 'TypeError') {
            throw new Error('Erreur de connexion réseau');
        }
        throw error;
    }
}

// Parser la réponse selon le type de modèle
function parseModelResponse(result, originalText, settings) {
    console.log('Réponse du modèle:', result);

    try {
        // Gestion des différents formats de réponse
        if (Array.isArray(result) && result.length > 0) {
            return extractCorrections(result, originalText, settings.confidenceThreshold);
        } else if (result && typeof result === 'object') {
            // Certains modèles retournent un objet avec generated_text
            if (result.generated_text) {
                return compareTexts(originalText, result.generated_text, settings.confidenceThreshold);
            }
        }

        return [];
    } catch (error) {
        console.error('Erreur parsing réponse:', error);
        return [];
    }
}

// Extraction des corrections à partir de la réponse du modèle
function extractCorrections(modelOutput, originalText, threshold = 0.7) {
    const corrections = [];

    try {
        modelOutput.forEach((prediction, index) => {
            if (prediction.score && prediction.score >= threshold) {
                corrections.push({
                    original: originalText,
                    suggestion: prediction.token_str || prediction.label || prediction.word,
                    confidence: prediction.score,
                    type: 'spelling',
                    position: { start: 0, end: originalText.length }
                });
            }
        });
    } catch (error) {
        console.error('Erreur extraction corrections:', error);
    }

    return corrections.slice(0, 3); // Limiter à 3 suggestions
}

// Comparaison de textes pour détecter les corrections
function compareTexts(original, corrected, threshold = 0.7) {
    const corrections = [];

    if (original !== corrected && corrected) {
        corrections.push({
            original: original,
            suggestion: corrected,
            confidence: threshold,
            type: 'correction',
            position: { start: 0, end: original.length }
        });
    }

    return corrections;
}

// Gestion des erreurs de démarrage
chrome.runtime.onStartup.addListener(() => {
    console.log('Service Worker démarré');

    // Vérifier et initialiser les paramètres si nécessaire
    chrome.storage.sync.get(['correctorEnabled']).then((result) => {
        if (result.correctorEnabled === undefined) {
            chrome.storage.sync.set({ correctorEnabled: true });
        }
    }).catch((error) => {
        console.error('Erreur au démarrage:', error);
    });
});

// Nettoyage périodique du cache (optionnel)
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create('clearCache', { periodInMinutes: 60 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'clearCache') {
        chrome.storage.local.clear().then(() => {
            console.log('Cache nettoyé');
        });
    }
});

// Gestion des erreurs globales
self.addEventListener('error', (event) => {
    console.error('Erreur Service Worker:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Promesse rejetée:', event.reason);
});
