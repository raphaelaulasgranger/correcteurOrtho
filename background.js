// Service Worker pour le module Chrome de correction orthographique

// Installation et initialisation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Correcteur IA Français installé');

    // Initialiser les paramètres par défaut
    chrome.storage.sync.set({
        correctorEnabled: true,
        correctionModel: 'camembert',
        confidenceThreshold: 0.7,
        maxSuggestions: 3,
        hfToken: ''
    });
});

// Gestion des messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message reçu:', request.action);

    if (request.action === 'getCorrections') {
        handleCorrections(request.text, sendResponse);
        return true; // Réponse asynchrone
    }

    if (request.action === 'updateSettings') {
        chrome.storage.sync.set(request.settings, () => {
            sendResponse({ success: true });
        });
        return true;
    }

    if (request.action === 'getSettings') {
        chrome.storage.sync.get(null, (settings) => {
            sendResponse({ success: true, settings });
        });
        return true;
    }
});

// Fonction de correction
async function handleCorrections(text, sendResponse) {
    try {
        // Récupérer les paramètres
        const settings = await new Promise(resolve => {
            chrome.storage.sync.get(null, resolve);
        });

        if (!settings.hfToken || settings.hfToken === '') {
            sendResponse({
                success: false,
                error: 'Token Hugging Face requis. Configurez-le dans les options.'
            });
            return;
        }

        // URLs CORRIGÉES des modèles
        const modelEndpoints = {
            camembert: 'https://api-inference.huggingface.co/models/camembert-base',
            flaubert: 'https://api-inference.huggingface.co/models/flaubert/flaubert_base_cased',
            barthez: 'https://api-inference.huggingface.co/models/moussaKam/barthez',
            gpt2_french: 'https://api-inference.huggingface.co/models/gilf/french-gpt-2'
        };

        const apiUrl = modelEndpoints[settings.correctionModel] || modelEndpoints.camembert;

        console.log('Appel API vers:', apiUrl);

        // Appel API
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
                    use_cache: false
                }
            })
        });

        console.log('Réponse API status:', response.status);

        if (!response.ok) {
            let errorMessage = `Erreur API: ${response.status}`;

            if (response.status === 401) {
                errorMessage = 'Token Hugging Face invalide ou expiré';
            } else if (response.status === 404) {
                errorMessage = 'Modèle non trouvé. Essayez un autre modèle.';
            } else if (response.status === 503) {
                errorMessage = 'Modèle en cours de chargement, réessayez dans quelques secondes';
            }

            sendResponse({ success: false, error: errorMessage });
            return;
        }

        const result = await response.json();
        console.log('Résultat API:', result);

        const corrections = parseCorrections(result, text, settings);

        sendResponse({ success: true, corrections });

    } catch (error) {
        console.error('Erreur lors de la correction:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Parser les corrections
function parseCorrections(result, originalText, settings) {
    const corrections = [];

    try {
        if (Array.isArray(result) && result.length > 0) {
            // Pour les modèles de type fill-mask
            result.forEach((prediction, index) => {
                if (prediction.score >= (settings.confidenceThreshold || 0.7)) {
                    corrections.push({
                        original: originalText,
                        suggestion: prediction.token_str || prediction.sequence,
                        confidence: prediction.score,
                        type: 'spelling',
                        position: { start: 0, end: originalText.length }
                    });
                }
            });
        } else if (result && result.generated_text) {
            // Pour les modèles génératifs
            const correctedText = result.generated_text;
            if (correctedText !== originalText) {
                corrections.push({
                    original: originalText,
                    suggestion: correctedText,
                    confidence: 0.8,
                    type: 'correction',
                    position: { start: 0, end: originalText.length }
                });
            }
        } else if (result && result[0] && result[0].generated_text) {
            // Format alternatif
            const correctedText = result[0].generated_text;
            if (correctedText !== originalText) {
                corrections.push({
                    original: originalText,
                    suggestion: correctedText,
                    confidence: 0.8,
                    type: 'correction',
                    position: { start: 0, end: originalText.length }
                });
            }
        }
    } catch (error) {
        console.error('Erreur parsing corrections:', error);
    }

    return corrections.slice(0, settings.maxSuggestions || 3);
}

// Gestion du démarrage
chrome.runtime.onStartup.addListener(() => {
    console.log('Service Worker démarré');
});
