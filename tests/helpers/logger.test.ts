import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger } from '../../src/helpers/logger'

let consoleSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })
})

afterEach(() => {
    consoleSpy.mockRestore()
})

// ─── logger.log ───────────────────────────────────────────────────────────────

describe('logger.log()', () => {
    it('calls console.log once per call', () => {
        logger.log('info', 'testFn', 'hello')
        expect(consoleSpy).toHaveBeenCalledTimes(1)
    })

    it('output contains the location tag', () => {
        logger.log('info', 'myFunction', 'some message')
        const output = consoleSpy.mock.calls[0]!.join(' ')
        expect(output).toContain('myFunction')
    })

    it('output contains the message', () => {
        logger.log('info', 'myFunction', 'some message')
        const output = consoleSpy.mock.calls[0]!.join(' ')
        expect(output).toContain('some message')
    })

    it('output contains the level tag', () => {
        logger.log('error', 'myFunction', 'boom')
        const output = consoleSpy.mock.calls[0]!.join(' ')
        expect(output).toContain('ERROR')
    })

    it('output contains the icon for each level', () => {
        const icons: Record<string, string> = {
            info: '→',
            success: '✓',
            warn: '!',
            error: '✕',
            debug: '•',
        }

        for (const [level, icon] of Object.entries(icons)) {
            consoleSpy.mockClear()
            logger.log(level as any, 'fn', 'msg')
            const output = consoleSpy.mock.calls[0]!.join(' ')
            expect(output).toContain(icon)
        }
    })
})

// ─── Shorthand methods ────────────────────────────────────────────────────────

describe('logger shorthands', () => {
    it('logger.info calls log with level "info"', () => {
        const spy = vi.spyOn(logger, 'log')
        logger.info('loadConfig', 'loading...')
        expect(spy).toHaveBeenCalledWith('info', 'loadConfig', 'loading...')
        spy.mockRestore()
    })

    it('logger.success calls log with level "success"', () => {
        const spy = vi.spyOn(logger, 'log')
        logger.success('generate', 'done')
        expect(spy).toHaveBeenCalledWith('success', 'generate', 'done')
        spy.mockRestore()
    })

    it('logger.warn calls log with level "warn"', () => {
        const spy = vi.spyOn(logger, 'log')
        logger.warn('mergeWithDefaults', 'deprecated field')
        expect(spy).toHaveBeenCalledWith('warn', 'mergeWithDefaults', 'deprecated field')
        spy.mockRestore()
    })

    it('logger.error calls log with level "error"', () => {
        const spy = vi.spyOn(logger, 'log')
        logger.error('generate', 'something broke')
        expect(spy).toHaveBeenCalledWith('error', 'generate', 'something broke')
        spy.mockRestore()
    })

    it('logger.debug calls log with level "debug"', () => {
        const spy = vi.spyOn(logger, 'log')
        logger.debug('parseCSharpFiles', 'scanning...')
        expect(spy).toHaveBeenCalledWith('debug', 'parseCSharpFiles', 'scanning...')
        spy.mockRestore()
    })
})

// ─── logger.tree ──────────────────────────────────────────────────────────────

describe('logger.tree()', () => {
    it('calls console.log correct number of times (log line + label + items)', () => {
        logger.tree(['a.csproj', 'b.csproj', 'c.csproj'], 'Projects', 'info', 'Projects:')
        // 1 log line + 1 label + 3 items = 5
        expect(consoleSpy).toHaveBeenCalledTimes(5)
    })

    it('last item uses └── branch', () => {
        logger.tree(['first.cs', 'last.cs'], 'Files', 'info', 'Files:')
        // calls: [0] log line, [1] label, [2] first.cs, [3] last.cs
        const lastItemCall = consoleSpy.mock.calls[3]!.join(' ')
        expect(lastItemCall).toContain('└──')
    })

    it('non-last items use ├── branch', () => {
        logger.tree(['first.cs', 'middle.cs', 'last.cs'], 'Files', 'info', 'Files:')
        // calls: [0] log line, [1] label, [2] first.cs, [3] middle.cs, [4] last.cs
        const firstItemCall = consoleSpy.mock.calls[2]!.join(' ')
        expect(firstItemCall).toContain('├──')
    })

    it('each item label appears in output', () => {
        logger.tree(['foo.cs', 'bar.cs'], 'Label', 'info', 'Label:')
        const allOutput = consoleSpy.mock.calls.flat().join(' ')
        expect(allOutput).toContain('foo.cs')
        expect(allOutput).toContain('bar.cs')
    })

    it('defaults to info level when no level is passed', () => {
        expect(() => logger.tree(['item'], 'label')).not.toThrow()
    })

    it('handles an empty items array — only prints log line + label', () => {
        logger.tree([], 'Empty', 'info', 'Empty:')
        expect(consoleSpy).toHaveBeenCalledTimes(2)
    })

    it('handles a single item — uses └── not ├──', () => {
        logger.tree(['only.cs'], 'Single', 'info', 'Single:')
        // calls: [0] log line, [1] label, [2] only.cs
        const itemCall = consoleSpy.mock.calls[2]!.join(' ')
        expect(itemCall).toContain('└──')
        expect(itemCall).not.toContain('├──')
    })
})