import chalk from 'chalk';
const LEVEL_WIDTH = 9; // '[SUCCESS]' = 9 chars
const LOC_WIDTH = 24; // location column width
const LEVELS = {
    info: msg => chalk.cyan(msg),
    success: msg => chalk.green.bold(msg),
    warn: msg => chalk.yellow.bold(msg),
    error: msg => chalk.red.bold(msg),
    debug: msg => chalk.gray(msg),
};
const ICONS = {
    info: '→',
    success: '✓',
    warn: '!',
    error: '✕',
    debug: '•',
};
const pad = (str, width) => str.padEnd(width, ' ');
export const logger = {
    log(level, location, message) {
        const icon = ICONS[level];
        const lvlTag = LEVELS[level](pad(`[${level.toUpperCase()}]`, LEVEL_WIDTH));
        const locTag = chalk.magenta(pad(`[${location}]`, LOC_WIDTH));
        const msg = chalk.white(message);
        console.log(`${icon}  ${lvlTag}  ${locTag}  ${msg}`);
    },
    info: (location, message) => logger.log('info', location, message),
    success: (location, message) => logger.log('success', location, message),
    warn: (location, message) => logger.log('warn', location, message),
    error: (location, message) => logger.log('error', location, message),
    debug: (location, message) => logger.log('debug', location, message),
    divider() {
        console.log(chalk.gray('─'.repeat(100)));
    },
    tree(items, methodName = 'generate', level = 'info', label) {
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
    shortPath: (fullPath, depth = 3) => {
        return '.../' + fullPath.split(/[\\/]/).slice(-depth).join('/');
    },
};
//# sourceMappingURL=logger.js.map