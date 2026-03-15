/**
 * InputManager — handles raw keyboard/mouse events for the game.
 * Extracted from UIManager to separate input concerns.
 *
 * Tracks which movement keys are held, handles right-drag camera orbit,
 * and dispatches click events to the UIManager delegate.
 */
export class InputManager {
    /**
     * @param {HTMLElement} canvas - The game canvas element
     */
    constructor(canvas) {
        this.canvas = canvas;
        /** Set of currently held movement keys */
        this.keys = new Set();
        /** Whether right mouse button is held (camera drag) */
        this.isRDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        /** Named key handlers registered with onKey() */
        this._keyHandlers = new Map();
        /** Delegate UIManager — set after construction */
        this.delegate = null;
    }

    /**
     * Register a named key handler.
     * @param {string} key - Key string (case-insensitive)
     * @param {Function} handler - Called when key is pressed
     */
    onKey(key, handler) {
        const k = String(key || '').toLowerCase();
        if (!k || typeof handler !== 'function') return;
        if (!this._keyHandlers.has(k)) this._keyHandlers.set(k, []);
        this._keyHandlers.get(k).push(handler);
    }

    /**
     * Attach all DOM event listeners.
     * @param {object} delegate - UIManager instance
     */
    setup(delegate) {
        this.delegate = delegate;

        window.addEventListener('keydown', (e) => this._onKeyDown(e));
        window.addEventListener('keyup',   (e) => this._onKeyUp(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.canvas.addEventListener('mousedown',   (e) => this._onMouseDown(e));
        window.addEventListener('mouseup',          ()  => this._onMouseUp());
        window.addEventListener('mousemove',        (e) => this._onMouseMove(e));
        this.canvas.addEventListener('mousemove',   (e) => this._onCanvasMouseMove(e));
        this.canvas.addEventListener('mouseleave',  ()  => { if (delegate.clearBuildGhost) delegate.clearBuildGhost(); });
    }

    _onKeyDown(e) {
        const k = e.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'shift'].includes(k)) this.keys.add(k);

        // Dispatch named handlers
        const handlers = this._keyHandlers.get(k);
        if (handlers) handlers.forEach(h => h(e));

        this.delegate?._onKeyDown?.(e);
    }

    _onKeyUp(e) {
        this.keys.delete(e.key.toLowerCase());
    }

    _onMouseDown(e) {
        if (e.button === 2) {
            this.isRDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.canvas.style.cursor = 'grabbing';
            return;
        }
        this.delegate?._onCanvasClick?.(e);
    }

    _onMouseUp() {
        this.isRDragging = false;
        this.canvas.style.cursor = 'crosshair';
    }

    _onMouseMove(e) {
        if (!this.isRDragging) return;
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.delegate?._onCameraDrag?.(dx, dy);
    }

    _onCanvasMouseMove(e) {
        if (!this.isRDragging) {
            this.delegate?._onCanvasHover?.(e);
        }
    }

    /** Whether movement key is currently held */
    isMoving(key) {
        return this.keys.has(key.toLowerCase());
    }

    destroy() {
        // Event listeners were added with anonymous functions and cannot be removed
        // individually. Call this before discarding the object.
        this.delegate = null;
        this.keys.clear();
    }
}
