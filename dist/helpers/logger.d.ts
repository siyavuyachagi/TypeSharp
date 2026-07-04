type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';
export declare const logger: {
    log(level: LogLevel, location: string, message: string): void;
    info: (location: string, message: string) => void;
    success: (location: string, message: string) => void;
    warn: (location: string, message: string) => void;
    error: (location: string, message: string) => void;
    debug: (location: string, message: string) => void;
    divider(): void;
    tree(items: string[], methodName?: string, level?: LogLevel, label?: string): void;
    shortPath: (fullPath: string, depth?: number) => string;
};
export {};
//# sourceMappingURL=logger.d.ts.map