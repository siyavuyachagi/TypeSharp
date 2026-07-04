import chalk from 'chalk';

type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';

const LEVEL_WIDTH = 9;   // '[SUCCESS]' = 9 chars
const LOC_WIDTH = 24;  // location column width

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

const pad = (str: string, width: number) => str.padEnd(width, ' ');

export const logger = {
    log(level: LogLevel, location: string, message: string): void {
        const icon = ICONS[level];
        const lvlTag = LEVELS[level](pad(`[${level.toUpperCase()}]`, LEVEL_WIDTH));
        const locTag = chalk.magenta(pad(`[${location}]`, LOC_WIDTH));
        const msg = chalk.white(message);

        console.log(`${icon}  ${lvlTag}  ${locTag}  ${msg}`);
    },

    info: (location: string, message: string) => logger.log('info', location, message),
    success: (location: string, message: string) => logger.log('success', location, message),
    warn: (location: string, message: string) => logger.log('warn', location, message),
    error: (location: string, message: string) => logger.log('error', location, message),
    debug: (location: string, message: string) => logger.log('debug', location, message),

    divider(): void {
        console.log(chalk.gray('─'.repeat(100)));
    },

    tree(items: string[], methodName: string = 'generate', level: LogLevel = 'info', label?: string): void {
        const icon = ICONS[level];
        const lvlTag = LEVELS[level](pad(`[${level.toUpperCase()}]`, LEVEL_WIDTH));
        const locTag = chalk.magenta(pad(`[${methodName}]`, LOC_WIDTH));
        console.log(`${icon}  ${lvlTag}  ${locTag}`);
        if (label) {
            console.log(`${' '.repeat(40)}${chalk.white(label)}`);
        }
        items.forEach((item, i) => {
            const isLast = i === items.length - 1;
            const branch = chalk.gray(isLast ? '└──' : '├──');
            // Align with message content (40 chars: icon(1) + spaces(2) + level(9) + spaces(2) + location(24) + spaces(2))
            const short = item.replace(/\\/g, '\\');
            console.log(`${' '.repeat(40)}${branch} ${chalk.white(short)}`);
        });
    },


    shortPath: (fullPath: string, depth = 3): string => {
        return '.../' + fullPath.split(/[\\/]/).slice(-depth).join('/');
    },
};