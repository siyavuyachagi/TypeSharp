import chalk from 'chalk';
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
export const logger = {
    log(level, location, message) {
        const icon = ICONS[level];
        const lvlTag = LEVELS[level](`[${level.toUpperCase()}]`);
        const locTag = chalk.magenta(`[${location}]`);
        const msg = chalk.white(message);
        console.log(`${icon}  ${lvlTag} ${locTag} ${msg}`);
    },
    info: (location, message) => logger.log('info', location, message),
    success: (location, message) => logger.log('success', location, message),
    warn: (location, message) => logger.log('warn', location, message),
    error: (location, message) => logger.log('error', location, message),
    debug: (location, message) => logger.log('debug', location, message),
    tree(label, items, level = 'debug') {
        console.log(LEVELS[level](label));
        items.forEach((item, i) => {
            const branch = chalk.gray(i === items.length - 1 ? '└──' : '├──');
            console.log(`${branch} ${chalk.white(item)}`);
        });
    },
};
//# sourceMappingURL=logger.js.map