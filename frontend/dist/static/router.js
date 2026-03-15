/**
 * Simple hash-based SPA router.
 */
const router = {
    routes: {},
    currentPage: null,

    /** Register a route handler. */
    on(path, handler) {
        this.routes[path] = handler;
    },

    /** Navigate to a path. */
    navigate(path) {
        window.location.hash = path;
    },

    /** Resolve current hash and invoke the matching handler. */
    resolve() {
        const hash = window.location.hash.slice(1) || '/';
        const parts = hash.split('/').filter(Boolean);

        // Try exact match first
        if (this.routes[hash]) {
            this.currentPage = hash;
            this.routes[hash]();
            this._updateNav(hash);
            return;
        }

        // Try parameterized routes: /exam/:id, /attempt/:id, /review/:id
        for (const [pattern, handler] of Object.entries(this.routes)) {
            const patternParts = pattern.split('/').filter(Boolean);
            if (patternParts.length !== parts.length) continue;

            const params = {};
            let match = true;
            for (let i = 0; i < patternParts.length; i++) {
                if (patternParts[i].startsWith(':')) {
                    params[patternParts[i].slice(1)] = parts[i];
                } else if (patternParts[i] !== parts[i]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                this.currentPage = pattern;
                handler(params);
                this._updateNav(pattern);
                return;
            }
        }

        // Default: library
        this.navigate('/');
    },

    /** Update active nav link. */
    _updateNav(path) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === '#' + path);
        });
    },

    /** Start listening for hash changes. */
    start() {
        window.addEventListener('hashchange', () => this.resolve());
        this.resolve();
    },
};
