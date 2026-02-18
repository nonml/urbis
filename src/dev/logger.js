// Debug logging system with levels
// Production default: warn+
// Dev default: info+

export const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4,
};

export const LOG_LEVEL_NAMES = {
    0: 'ERROR',
    1: 'WARN',
    2: 'INFO',
    3: 'DEBUG',
    4: 'TRACE',
};

export class Logger {
    constructor() {
        this.level = this._getLogLevel();
        this.prefix = '[CityBuilder]';
        this.maxLogSize = 100;
        this.history = [];
    }

    /**
     * Gets the log level from localStorage or defaults to INFO
     */
    _getLogLevel() {
        try {
            const stored = localStorage.getItem('cityBuilderLogLevel');
            if (stored && LOG_LEVELS[stored] !== undefined) {
                return LOG_LEVELS[stored];
            }
        } catch (e) {
            // localStorage not available, use default
        }
        // Default to INFO for production
        return LOG_LEVELS.INFO;
    }

    /**
     * Sets the log level
     * @param {string|number} level - Level name or number
     */
    setLevel(level) {
        if (typeof level === 'string') {
            this.level = LOG_LEVELS[level] ?? LOG_LEVELS.INFO;
        } else {
            this.level = level;
        }
        try {
            localStorage.setItem('cityBuilderLogLevel', Object.keys(LOG_LEVELS)[this.level]);
        } catch (e) {
            // localStorage not available
        }
    }

    /**
     * Checks if a log level is enabled
     */
    isEnabled(level) {
        return level <= this.level;
    }

    /**
     * Logs an error message
     */
    error(...args) {
        if (this.isEnabled(LOG_LEVELS.ERROR)) {
            this._log('ERROR', args);
        }
    }

    /**
     * Logs a warning message
     */
    warn(...args) {
        if (this.isEnabled(LOG_LEVELS.WARN)) {
            this._log('WARN', args);
        }
    }

    /**
     * Logs an info message
     */
    info(...args) {
        if (this.isEnabled(LOG_LEVELS.INFO)) {
            this._log('INFO', args);
        }
    }

    /**
     * Logs a debug message
     */
    debug(...args) {
        if (this.isEnabled(LOG_LEVELS.DEBUG)) {
            this._log('DEBUG', args);
        }
    }

    /**
     * Logs a trace message with stack trace
     */
    trace(...args) {
        if (this.isEnabled(LOG_LEVELS.TRACE)) {
            const stack = new Error().stack?.split('\n').slice(2).join('\n') || '';
            this._log('TRACE', [...args, stack]);
        }
    }

    /**
     * Internal log method
     */
    _log(levelName, args) {
        const timestamp = new Date().toISOString();
        const formattedArgs = args.map(arg => {
            if (arg instanceof Error) {
                return arg.message + (arg.stack ? '\n' + arg.stack : '');
            }
            if (typeof arg === 'object') {
                return JSON.stringify(arg);
            }
            return String(arg);
        });

        const message = `${this.prefix} [${timestamp}] [${levelName}] ${formattedArgs.join(' ')}`;

        // Store in history
        this.history.push({ level: levelName, message, timestamp });
        if (this.history.length > this.maxLogSize) {
            this.history.shift();
        }

        // Output to console
        switch (levelName) {
            case 'ERROR':
                console.error(message);
                break;
            case 'WARN':
                console.warn(message);
                break;
            case 'INFO':
                console.info(message);
                break;
            case 'DEBUG':
                console.debug(message);
                break;
            case 'TRACE':
                console.trace(message);
                break;
        }
    }

    /**
     * Gets recent log history
     */
    getHistory() {
        return [...this.history];
    }

    /**
     * Clears log history
     */
    clearHistory() {
        this.history = [];
    }
}

// Singleton instance
export const logger = new Logger();