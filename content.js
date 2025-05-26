// Configuration de l'API Hugging Face
const HF_TOKEN = 'YOUR_HUGGING_FACE_TOKEN'; // Remplacé par le token de l'utilisateur

// Vérifier si le correcteur est déjà initialisé pour éviter la duplication
if (window.correcteurIAInitialized) {
    console.log('Correcteur IA déjà initialisé, arrêt.');
} else {
    window.correcteurIAInitialized = true;

    class CorrecteurIA {
        constructor() {
            this.isEnabled = true;
            this.debounceTimer = null;
            this.currentElement = null;
            this.corrections = new Map();
            this.settings = {};
            this.initialized = false;
            this.init();
        }

        async init() {
            if (this.initialized) return;

            console.log('Initialisation du Correcteur IA');
            await this.loadSettings();
            this.attachEventListeners();
            this.createCorrectionToggle();
            this.initialized = true;
        }

        async loadSettings() {
            return new Promise((resolve) => {
                chrome.storage.sync.get(null, (result) => {
                    this.settings = {
                        correctorEnabled: result.correctorEnabled ?? true,
                        correctionModel: result.correctionModel ?? 'camembert',
                        hfToken: result.hfToken ?? '',
                        confidenceThreshold: result.confidenceThreshold ?? 0.7,
                        maxSuggestions: result.maxSuggestions ?? 3
                    };
                    this.isEnabled = this.settings.correctorEnabled;
                    console.log('Paramètres chargés:', this.settings);
                    resolve();
                });
            });
        }

        attachEventListeners() {
            // Écouter les événements de saisie sur tous les champs de texte
            document.addEventListener('input', (e) => {
                if (this.isTextInput(e.target) && this.isEnabled && this.settings.hfToken) {
                    this.handleInput(e);
                }
            }, { passive: true });

            // Écouter les clics pour fermer les popups
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.correction-popup')) {
                    this.hideAllPopups();
                }
            }, { passive: true });

            // Écouter les changements de focus
            document.addEventListener('focusin', (e) => {
                if (this.isTextInput(e.target)) {
                    this.currentElement = e.target;
                }
            }, { passive: true });

            // Écouter les mises à jour de paramètres
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                if (message.action === 'settingsUpdated') {
                    this.settings = message.settings;
                    this.isEnabled = this.settings.correctorEnabled;
                    console.log('Paramètres mis à jour:', this.settings);
                }
            });

            // Raccourcis clavier
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.shiftKey && e.key === 'C') {
                    e.preventDefault();
                    this.toggleCorrector();
                }
                if (e.key === 'Escape') {
                    this.hideAllPopups();
                }
            });
        }

        isTextInput(element) {
            const textInputTypes = ['text', 'email', 'password', 'search', 'url', 'tel'];
            return (
                element.tagName === 'TEXTAREA' ||
                (element.tagName === 'INPUT' && textInputTypes.includes(element.type)) ||
                element.contentEditable === 'true' ||
                element.getAttribute('role') === 'textbox'
            );
        }

        handleInput(event) {
            clearTimeout(this.debounceTimer);

            this.debounceTimer = setTimeout(() => {
                this.analyzeText(event.target);
            }, 1000); // Augmenté à 1 seconde pour réduire les appels API
        }

        async analyzeText(element) {
            const text = this.getElementText(element);

            if (text.length < 15 || !this.settings.hfToken) return; // Texte minimum plus long

            try {
                console.log('Analyse du texte:', text.substring(0, 50) + '...');

                const response = await chrome.runtime.sendMessage({
                    action: 'getCorrections',
                    text: text
                });

                if (response && response.success && response.corrections.length > 0) {
                    console.log('Corrections reçues:', response.corrections);
                    this.displayCorrections(element, response.corrections);
                } else if (response && !response.success) {
                    console.error('Erreur correction:', response.error);
                }
            } catch (error) {
                console.error('Erreur lors de l\'analyse:', error);
            }
        }

        displayCorrections(element, corrections) {
            // Supprimer les anciens marqueurs pour cet élément
            this.clearCorrectionsForElement(element);

            corrections.forEach((correction, index) => {
                this.createCorrectionMarker(element, correction, index);
            });
        }

        createCorrectionMarker(element, correction, index) {
            const rect = element.getBoundingClientRect();
            const marker = document.createElement('div');
            marker.className = 'correction-marker';
            marker.dataset.elementId = this.getElementId(element);

            marker.innerHTML = `
                <div class="error-underline" title="Cliquez pour voir la suggestion"></div>
                <div class="correction-popup" style="display: none;">
                    <div class="correction-suggestion">
                        <strong>Texte original:</strong> ${correction.original}<br>
                        <strong>Suggestion:</strong> ${correction.suggestion}<br>
                        <small>Confiance: ${Math.round(correction.confidence * 100)}%</small>
                    </div>
                    <div class="correction-actions">
                        <button class="accept-correction" data-original="${correction.original}" data-suggestion="${correction.suggestion}">
                            ✓ Accepter
                        </button>
                        <button class="ignore-correction">
                            ✗ Ignorer
                        </button>
                    </div>
                </div>
            `;

            // Positionner le marqueur
            marker.style.position = 'absolute';
            marker.style.left = `${rect.left + window.scrollX + (index * 20)}px`;
            marker.style.top = `${rect.bottom + window.scrollY + 2}px`;
            marker.style.zIndex = '10000';

            document.body.appendChild(marker);

            // Ajouter les événements
            const underline = marker.querySelector('.error-underline');
            const acceptBtn = marker.querySelector('.accept-correction');
            const ignoreBtn = marker.querySelector('.ignore-correction');

            underline.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showCorrectionPopup(marker);
            });

            acceptBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.applyCorrection(element, e.target.dataset.original, e.target.dataset.suggestion);
                marker.remove();
            });

            ignoreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                marker.remove();
            });
        }

        getElementId(element) {
            if (element.id) return element.id;
            if (element.name) return element.name;
            return Date.now() + Math.random();
        }

        clearCorrectionsForElement(element) {
            const elementId = this.getElementId(element);
            document.querySelectorAll(`.correction-marker[data-element-id="${elementId}"]`).forEach(marker => {
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

        applyCorrection(element, original, suggestion) {
            const text = this.getElementText(element);
            const correctedText = text.replace(original, suggestion);
            this.setElementText(element, correctedText);

            // Mettre à jour les statistiques
            this.updateStats('accepted');
        }

        getElementText(element) {
            if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
                return element.value;
            } else if (element.contentEditable === 'true') {
                return element.textContent || element.innerText;
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

        toggleCorrector() {
            this.isEnabled = !this.isEnabled;
            const toggle = document.getElementById('correction-toggle');
            if (toggle) {
                const button = toggle.querySelector('#toggle-correction');
                button.textContent = this.isEnabled ? 'ON' : 'OFF';
                toggle.style.background = this.isEnabled ? '#4CAF50' : '#f44336';
            }

            // Sauvegarder le nouvel état
            this.settings.correctorEnabled = this.isEnabled;
            chrome.storage.sync.set({ correctorEnabled: this.isEnabled });

            if (!this.isEnabled) {
                this.hideAllPopups();
            }
        }

        createCorrectionToggle() {
            // Éviter la création multiple
            if (document.getElementById('correction-toggle')) return;

            const toggle = document.createElement('div');
            toggle.id = 'correction-toggle';
            toggle.innerHTML = `
                <div class="toggle-content">
                    <span>Correcteur IA</span>
                    <button id="toggle-correction">${this.isEnabled ? 'ON' : 'OFF'}</button>
                </div>
            `;

            toggle.style.cssText = `
                position: fixed !important;
                bottom: 20px !important;
                right: 20px !important;
                background: ${this.isEnabled ? '#4CAF50' : '#f44336'} !important;
                color: white !important;
                padding: 10px 15px !important;
                border-radius: 25px !important;
                z-index: 10001 !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                font-size: 12px !important;
                cursor: pointer !important;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2) !important;
                transition: all 0.3s ease !important;
                user-select: none !important;
            `;

            document.body.appendChild(toggle);

            toggle.addEventListener('click', () => {
                this.toggleCorrector();
            });
        }

        updateStats(action) {
            chrome.storage.local.get(['stats'], (result) => {
                const stats = result.stats || {
                    correctionsCount: 0,
                    acceptedCount: 0,
                    ignoredCount: 0
                };

                if (action === 'accepted') {
                    stats.acceptedCount++;
                } else if (action === 'ignored') {
                    stats.ignoredCount++;
                }
                stats.correctionsCount++;

                chrome.storage.local.set({ stats });
            });
        }
    }

    // Initialiser le correcteur seulement si pas déjà fait
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new CorrecteurIA();
        });
    } else {
        new CorrecteurIA();
    }
}
