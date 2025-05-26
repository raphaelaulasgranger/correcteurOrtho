// Configuration de l'API Hugging Face
const HF_API_URL = 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium';
const HF_TOKEN = 'YOUR_HUGGING_FACE_TOKEN'; // À remplacer par votre token

class CorrecteurIA {
    constructor() {
        this.isEnabled = true;
        this.debounceTimer = null;
        this.currentElement = null;
        this.corrections = new Map();
        this.init();
    }

    init() {
        this.attachEventListeners();
        this.createCorrectionPopup();
        this.loadSettings();
    }

    attachEventListeners() {
        // Écouter les événements de saisie sur tous les champs de texte
        document.addEventListener('input', (e) => {
            if (this.isTextInput(e.target) && this.isEnabled) {
                this.handleInput(e);
            }
        });

        // Écouter les clics pour fermer les popups
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.correction-popup')) {
                this.hideAllPopups();
            }
        });

        // Écouter les changements de focus
        document.addEventListener('focusin', (e) => {
            if (this.isTextInput(e.target)) {
                this.currentElement = e.target;
            }
        });
    }

    isTextInput(element) {
        const textInputTypes = ['text', 'email', 'password', 'search', 'url'];
        return (
            element.tagName === 'TEXTAREA' ||
            (element.tagName === 'INPUT' && textInputTypes.includes(element.type)) ||
            element.contentEditable === 'true'
        );
    }

    handleInput(event) {
        clearTimeout(this.debounceTimer);

        this.debounceTimer = setTimeout(() => {
            this.analyzeText(event.target);
        }, 500); // Attendre 500ms après la dernière saisie
    }

    async analyzeText(element) {
        const text = this.getElementText(element);

        if (text.length < 10) return; // Ignorer les textes trop courts

        try {
            const corrections = await this.getCorrections(text);
            if (corrections && corrections.length > 0) {
                this.highlightErrors(element, corrections);
            }
        } catch (error) {
            console.error('Erreur lors de la correction:', error);
        }
    }

    async getCorrections(text) {
        // Utilisation de l'API Hugging Face pour la correction
        const response = await fetch(HF_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HF_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: `Corrige l'orthographe et la grammaire: "${text}"`,
                parameters: {
                    max_length: text.length + 50,
                    temperature: 0.3,
                    do_sample: true
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Erreur API: ${response.status}`);
        }

        const result = await response.json();
        return this.parseCorrections(text, result);
    }

    parseCorrections(originalText, apiResult) {
        // Analyse simple des corrections (à améliorer selon le modèle utilisé)
        if (!apiResult || !apiResult[0] || !apiResult[0].generated_text) {
            return [];
        }

        const correctedText = apiResult[0].generated_text.replace(/^Corrige l'orthographe et la grammaire: ".*?" ?/i, '').trim();

        // Comparaison basique mot par mot
        const originalWords = originalText.split(/\s+/);
        const correctedWords = correctedText.split(/\s+/);
        const corrections = [];

        for (let i = 0; i < Math.min(originalWords.length, correctedWords.length); i++) {
            if (originalWords[i] !== correctedWords[i]) {
                corrections.push({
                    word: originalWords[i],
                    suggestion: correctedWords[i],
                    position: this.findWordPosition(originalText, originalWords[i], i)
                });
            }
        }

        return corrections;
    }

    findWordPosition(text, word, wordIndex) {
        const words = text.split(/\s+/);
        let position = 0;

        for (let i = 0; i < wordIndex; i++) {
            position = text.indexOf(words[i], position) + words[i].length;
        }

        return {
            start: text.indexOf(word, position),
            end: text.indexOf(word, position) + word.length
        };
    }

    highlightErrors(element, corrections) {
        // Créer des marqueurs visuels pour les erreurs
        corrections.forEach(correction => {
            this.createErrorMarker(element, correction);
        });
    }

    createErrorMarker(element, correction) {
        const rect = element.getBoundingClientRect();
        const marker = document.createElement('div');
        marker.className = 'correction-marker';
        marker.innerHTML = `
        <div class="error-underline"></div>
        <div class="correction-popup" style="display: none;">
        <div class="correction-suggestion">
        <strong>Suggestion:</strong> ${correction.suggestion}
        </div>
        <div class="correction-actions">
        <button class="accept-correction" data-original="${correction.word}" data-suggestion="${correction.suggestion}">
        Accepter
        </button>
        <button class="ignore-correction">
        Ignorer
        </button>
        </div>
        </div>
        `;

        // Positionner le marqueur
        marker.style.position = 'absolute';
        marker.style.left = `${rect.left + correction.position.start * 8}px`; // Approximation
        marker.style.top = `${rect.top + rect.height}px`;
        marker.style.zIndex = '10000';

        document.body.appendChild(marker);

        // Ajouter les événements
        marker.querySelector('.error-underline').addEventListener('click', () => {
            this.showCorrectionPopup(marker);
        });

        marker.querySelector('.accept-correction').addEventListener('click', (e) => {
            this.applyCorrectionText(element, e.target.dataset.original, e.target.dataset.suggestion);
            marker.remove();
        });

        marker.querySelector('.ignore-correction').addEventListener('click', () => {
            marker.remove();
        });
    }

    showCorrectionPopup(marker) {
        this.hideAllPopups();
        const popup = marker.querySelector('.correction-popup');
        popup.style.display = 'block';
    }

    hideAllPopups() {
        document.querySelectorAll('.correction-popup').forEach(popup => {
            popup.style.display = 'none';
        });
    }

    applyCorrectionText(element, original, suggestion) {
        const text = this.getElementText(element);
        const correctedText = text.replace(new RegExp(original, 'g'), suggestion);
        this.setElementText(element, correctedText);
    }

    getElementText(element) {
        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            return element.value;
        } else if (element.contentEditable === 'true') {
            return element.textContent;
        }
        return '';
    }

    setElementText(element, text) {
        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            element.value = text;
        } else if (element.contentEditable === 'true') {
            element.textContent = text;
        }

        // Déclencher l'événement input pour les frameworks JS
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    createCorrectionPopup() {
        // Interface pour activer/désactiver le correcteur
        const toggle = document.createElement('div');
        toggle.id = 'correction-toggle';
        toggle.innerHTML = `
        <div class="toggle-content">
        <span>Correcteur IA</span>
        <button id="toggle-correction">${this.isEnabled ? 'ON' : 'OFF'}</button>
        </div>
        `;
        toggle.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 10px;
        border-radius: 5px;
        z-index: 10001;
        font-family: Arial, sans-serif;
        font-size: 12px;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;

        document.body.appendChild(toggle);

        toggle.addEventListener('click', () => {
            this.isEnabled = !this.isEnabled;
            document.getElementById('toggle-correction').textContent = this.isEnabled ? 'ON' : 'OFF';
            toggle.style.background = this.isEnabled ? '#4CAF50' : '#f44336';
            this.saveSettings();
        });
    }

    loadSettings() {
        chrome.storage.sync.get(['correctorEnabled'], (result) => {
            this.isEnabled = result.correctorEnabled !== false;
        });
    }

    saveSettings() {
        chrome.storage.sync.set({ correctorEnabled: this.isEnabled });
    }
}

// Initialiser le correcteur
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new CorrecteurIA();
    });
} else {
    new CorrecteurIA();
}
