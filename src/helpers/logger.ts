import chalk from 'chalk';

type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';

const LEVELS: Record<LogLevel, (msg: string) => string> = {
    info: msg => chalk.cyan(msg),
    success: msg => chalk.green.bold(msg),
    warn: msg => chalk.yellow.bold(msg),
    error: msg => chalk.red.bold(msg),
    debug: msg => chalk.gray(msg),
};

const ICONS: Record<LogLevel, string> = {
    info: '→',
    success: '✓',
    warn: '!',
    error: '✕',
    debug: '•',
};

export const logger = {
    log(level: LogLevel, location: string, message: string): void {
        const icon = ICONS[level];
        const lvlTag = LEVELS[level](`[${level.toUpperCase()}]`);
        const locTag = chalk.magenta(`[${location}]`);
        const msg = chalk.white(message);

        console.log(`${icon}  ${lvlTag} ${locTag} ${msg}`);
    },

    info: (location: string, message: string) => logger.log('info', location, message),
    success: (location: string, message: string) => logger.log('success', location, message),
    warn: (location: string, message: string) => logger.log('warn', location, message),
    error: (location: string, message: string) => logger.log('error', location, message),
    debug: (location: string, message: string) => logger.log('debug', location, message),

    tree(label: string, items: string[], level: LogLevel = 'debug'): void {
        console.log(LEVELS[level](label));
        items.forEach((item, i) => {
            const branch = chalk.gray(i === items.length - 1 ? '└──' : '├──');
            console.log(`${branch} ${chalk.white(item)}`);
        });
    },
};