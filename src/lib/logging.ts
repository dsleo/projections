export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type Logger = {
    debug: (msg: string, extra?: Record<string, unknown>) => void;
    info: (msg: string, extra?: Record<string, unknown>) => void;
    warn: (msg: string, extra?: Record<string, unknown>) => void;
    error: (msg: string, extra?: Record<string, unknown>) => void;
};

function write(level: LogLevel, msg: string, extra?: Record<string, unknown>) {
    const payload = {
        ts: new Date().toISOString(),
        level,
        msg,
        ...(extra ? { extra } : {}),
    };
    console[level === 'debug' ? 'log' : level](JSON.stringify(payload));
}

export function createLogger(context?: Record<string, unknown>): Logger {
    const withCtx = (extra?: Record<string, unknown>) => ({
        ...(context ?? {}),
        ...(extra ?? {}),
    });

    return {
        debug: (msg, extra) => write('debug', msg, withCtx(extra)),
        info: (msg, extra) => write('info', msg, withCtx(extra)),
        warn: (msg, extra) => write('warn', msg, withCtx(extra)),
        error: (msg, extra) => write('error', msg, withCtx(extra)),
    };
}

export async function time<T>(
    logger: Logger,
    name: string,
    fn: () => Promise<T>
): Promise<{ result: T; ms: number }> {
    const start = performance.now();
    try {
        const result = await fn();
        const ms = performance.now() - start;
        logger.info(`${name}:done`, { ms: Math.round(ms) });
        return { result, ms };
    } catch (e) {
        const ms = performance.now() - start;
        logger.error(`${name}:error`, {
            ms: Math.round(ms),
            error: e instanceof Error ? e.message : String(e),
        });
        throw e;
    }
}
