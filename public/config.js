// Runtime configuration for API URL
// This file can be modified after build (also copied to dist/config.js).
// Leave API_URL empty so the browser uses same-origin /api/* (nginx proxies to Node).
// That is the most reliable cookie/session setup.
//
// Only set API_URL if the API lives on a different origin, e.g.:
//   API_URL: 'https://api.example.com'
window.APP_CONFIG = {
  API_URL: ''
};
