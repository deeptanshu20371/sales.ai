(function() {
    // Centralized configuration for the Chrome extension
    // You may hardcode values here for local dev.
    // Fallback order used by background.js when generating messages:
    // 1) BACKEND_URL (/api/generate)
    // 2) OPENROUTER_API_KEY direct call (if provided)
    // 3) Local canned message (no network)
    self.GENREACH_CONFIG = {
        // Point to your running backend (FastAPI). Leave blank to skip.
        BACKEND_URL: 'http://localhost:8000',

        // Optional: put your OpenRouter API key here to call the model directly
        // from the extension background if the backend is unavailable.
        OPENROUTER_API_KEY: '', // e.g., 'sk-or-...'

        // Model id for OpenRouter fallback
        MODEL: 'meta-llama/llama-3.3-8b-instruct:free'
    };
})();
