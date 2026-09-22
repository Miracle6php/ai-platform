class RetryOperation {
    constructor(timeouts, options) {
        if (typeof options === "boolean") {
            options = { forever: options };
        }

        this._originalTimeouts = JSON.parse(JSON.stringify(timeouts));
        this._timeouts = timeouts;
        this._options = options || {};
        this._maxRetryTime =
            options && options.maxRetryTime !== undefined
                ? options.maxRetryTime
                : Infinity;

        this._fn = null;
        this._errors = [];
        this._attempts = 1;
        this._operationTimeout = null;
        this._operationTimeoutCb = null;
        this._timeout = null;
        this._operationStart = null;
        this._timer = null;

        if (this._options.forever) {
            this._cachedTimeouts = this._timeouts.slice(0);
        }
    }

    reset() {
        this._attempts = 1;
        this._timeouts = this._originalTimeouts.slice(0);
    }

    stop() {
        if (this._timeout) {
            clearTimeout(this._timeout);
        }

        if (this._timer) {
            clearTimeout(this._timer);
        }

        this._timeouts = [];
        this._cachedTimeouts = null;
    }

    retry(err) {
        if (this._timeout) {
            clearTimeout(this._timeout);
        }

        if (!err) {
            return false;
        }

        const currentTime = Date.now();

        if (
            currentTime - this._operationStart >=
            this._maxRetryTime
        ) {
            this._errors.push(err);
            this._errors.unshift(
                new Error("RetryOperation timeout occurred")
            );
            return false;
        }

        this._errors.push(err);

        let timeout = this._timeouts.shift();

        if (timeout === undefined) {
            if (this._cachedTimeouts) {
                this._errors.splice(
                    0,
                    this._errors.length - 1
                );

                timeout =
                    this._cachedTimeouts.slice(-1);
            } else {
                return false;
            }
        }

        this._timer = setTimeout(() => {
            this._attempts++;

            if (this._operationTimeoutCb) {
                this._timeout = setTimeout(() => {
                    this._operationTimeoutCb(
                        this._attempts
                    );
                }, this._operationTimeout);
            }

            this._fn(this._attempts);
        }, timeout);

        return true;
    }

    attempt(fn, timeoutOps) {
        this._fn = fn;

        if (timeoutOps) {
            if (timeoutOps.timeout) {
                this._operationTimeout =
                    timeoutOps.timeout;
            }

            if (timeoutOps.cb) {
                this._operationTimeoutCb =
                    timeoutOps.cb;
            }
        }

        if (this._operationTimeoutCb) {
            this._timeout = setTimeout(() => {
                this._operationTimeoutCb();
            }, this._operationTimeout);
        }

        this._operationStart = Date.now();

        this._fn(this._attempts);
    }

    try(fn) {
        this.attempt(fn);
    }

    start(fn) {
        this.attempt(fn);
    }

    errors() {
        return this._errors;
    }

    attempts() {
        return this._attempts;
    }

    mainError() {
        if (this._errors.length === 0) {
            return null;
        }

        const counts = {};
        let mainError = null;
        let mainErrorCount = 0;

        for (const error of this._errors) {
            const message = error.message;
            const count =
                (counts[message] || 0) + 1;

            counts[message] = count;

            if (count >= mainErrorCount) {
                mainError = error;
                mainErrorCount = count;
            }
        }

        return mainError;
    }
}

function createTimeout(attempt, opts) {
    const random = opts.randomize
        ? Math.random() + 1
        : 1;

    let timeout = Math.round(
        random *
        Math.max(opts.minTimeout, 1) *
        Math.pow(opts.factor, attempt)
    );

    timeout = Math.min(
        timeout,
        opts.maxTimeout
    );

    return timeout;
}

function timeouts(options) {
    if (Array.isArray(options)) {
        return [...options];
    }

    const opts = {
        retries: 10,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: Infinity,
        randomize: false
    };

    for (const key in options || {}) {
        opts[key] = options[key];
    }

    if (opts.minTimeout > opts.maxTimeout) {
        throw new Error(
            "minTimeout is greater than maxTimeout"
        );
    }

    const result = [];

    for (
        let i = 0;
        i < opts.retries;
        i++
    ) {
        result.push(
            createTimeout(i, opts)
        );
    }

    if (
        options &&
        options.forever &&
        result.length === 0
    ) {
        result.push(
            createTimeout(
                result.length,
                opts
            )
        );
    }

    result.sort((a, b) => a - b);

    return result;
}

function operation(options) {
    const retryTimeouts = timeouts(options);

    return new RetryOperation(
        retryTimeouts,
        {
            forever:
                options &&
                (
                    options.forever ||
                    options.retries === Infinity
                ),

            unref:
                options &&
                options.unref,

            maxRetryTime:
                options &&
                options.maxRetryTime
        }
    );
}

const retry = {
    operation,
    timeouts,
    createTimeout,

    wrap(obj, options, methods) {
        if (Array.isArray(options)) {
            methods = options;
            options = null;
        }

        if (!methods) {
            methods = [];

            for (const key in obj) {
                if (typeof obj[key] === "function") {
                    methods.push(key);
                }
            }
        }

        for (const method of methods) {
            const original = obj[method];

            obj[method] = function (...args) {
                const op = operation(options);
                const callback = args.pop();

                args.push(function (err) {
                    if (op.retry(err)) {
                        return;
                    }

                    if (err) {
                        arguments[0] =
                            op.mainError();
                    }

                    callback.apply(
                        this,
                        arguments
                    );
                });

                op.attempt(() => {
                    original.apply(obj, args);
                });
            };

            obj[method].options = options;
        }
    }
};

export default retry;
export { RetryOperation };
