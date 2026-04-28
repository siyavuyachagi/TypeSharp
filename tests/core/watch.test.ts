/// <reference types="node" />

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { EventEmitter } from 'events'

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../src/core/index.js', () => ({
    generate: vi.fn(),
    loadConfig: vi.fn(),
}))

// Static imports — vi.mock is hoisted above these by vitest
import { startWatch } from '../../src/core/watch.js'
import { generate, loadConfig } from '../../src/core/index.js'

const mockGenerate = vi.mocked(generate)
const mockLoadConfig = vi.mocked(loadConfig)

// ─── Helpers ────────────────────────────────────────────────────────────────

type WatchCallback = (event: string, filename: string | null) => void

function mockFsWatch(): { trigger: (filename: string) => void; restore: () => void } {
    let capturedCallback: WatchCallback | null = null

    const fakeWatcher = { close: vi.fn() }

    const spy = vi.spyOn(fs, 'watch').mockImplementation(
        (_path: fs.PathLike, _options: unknown, callback?: WatchCallback) => {
            if (typeof callback === 'function') capturedCallback = callback
            return fakeWatcher as unknown as fs.FSWatcher & EventEmitter
        }
    )

    return {
        trigger: (filename: string) => capturedCallback?.('change', filename),
        restore: () => spy.mockRestore(),
    }
}

function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('startWatch', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-watch-test-'))
        vi.clearAllMocks()
        // Re-apply implementations after clearAllMocks
        mockGenerate.mockResolvedValue(undefined)
        mockLoadConfig.mockResolvedValue({
            source: './src',
            outputPath: path.join(tmpDir, 'out'),
        })
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('runs an initial generation on start', async () => {
        const { trigger, restore } = mockFsWatch()

        await Promise.race([startWatch(undefined, true), wait(100)])

        expect(mockGenerate).toHaveBeenCalledTimes(1)
        expect(mockGenerate).toHaveBeenCalledWith(undefined, true)

        trigger('src/App.ts')
        restore()
    })

    it('passes incremental=true to initial generate', async () => {
        const { restore } = mockFsWatch()

        await Promise.race([startWatch(undefined, true), wait(100)])

        expect(mockGenerate).toHaveBeenCalledWith(undefined, true)
        restore()
    })

    it('passes incremental=false to initial generate when --no-incremental', async () => {
        const { restore } = mockFsWatch()

        await Promise.race([startWatch(undefined, false), wait(100)])

        expect(mockGenerate).toHaveBeenCalledWith(undefined, false)
        restore()
    })

    it('triggers incremental generation after a file change', async () => {
        const { trigger, restore } = mockFsWatch()

        await Promise.race([startWatch(undefined, true), wait(50)])

        trigger('src/pages/index.vue')

        // Wait for debounce (300ms) + buffer
        await wait(400)

        // 1 initial + 1 debounced = 2 total
        expect(mockGenerate).toHaveBeenCalledTimes(2)
        expect(mockGenerate).toHaveBeenLastCalledWith(undefined, true)

        restore()
    })

    it('debounces rapid file saves into a single generation', async () => {
        const { trigger, restore } = mockFsWatch()

        await Promise.race([startWatch(undefined, true), wait(50)])

        trigger('src/pages/index.vue')
        trigger('src/pages/about.vue')
        trigger('src/components/Header.vue')
        trigger('src/components/Footer.vue')
        trigger('src/app.ts')

        await wait(400)

        // 1 initial + 1 debounced batch = 2 total
        expect(mockGenerate).toHaveBeenCalledTimes(2)

        restore()
    })

    it('ignores changes inside node_modules', async () => {
        const { trigger, restore } = mockFsWatch()

        await Promise.race([startWatch(undefined, true), wait(50)])

        const callsBefore = mockGenerate.mock.calls.length

        trigger('node_modules/some-package/index.js')
        await wait(400)

        expect(mockGenerate).toHaveBeenCalledTimes(callsBefore)
        restore()
    })

    it('ignores changes inside .nuxt', async () => {
        const { trigger, restore } = mockFsWatch()

        await Promise.race([startWatch(undefined, true), wait(50)])

        const callsBefore = mockGenerate.mock.calls.length

        trigger('.nuxt/types/schema.d.ts')
        await wait(400)

        expect(mockGenerate).toHaveBeenCalledTimes(callsBefore)
        restore()
    })

    it('ignores changes inside .next', async () => {
        const { trigger, restore } = mockFsWatch()

        await Promise.race([startWatch(undefined, true), wait(50)])

        const callsBefore = mockGenerate.mock.calls.length

        trigger('.next/cache/webpack/client-production/0.pack')
        await wait(400)

        expect(mockGenerate).toHaveBeenCalledTimes(callsBefore)
        restore()
    })

    it('ignores changes inside .git', async () => {
        const { trigger, restore } = mockFsWatch()

        await Promise.race([startWatch(undefined, true), wait(50)])

        const callsBefore = mockGenerate.mock.calls.length

        trigger('.git/index')
        await wait(400)

        expect(mockGenerate).toHaveBeenCalledTimes(callsBefore)
        restore()
    })

    it('ignores null filename events', async () => {
        let capturedCallback: WatchCallback | null = null
        const fakeWatcher = { close: vi.fn() }

        const spy = vi.spyOn(fs, 'watch').mockImplementation(
            (_p: fs.PathLike, _o: unknown, cb?: WatchCallback) => {
                if (cb) capturedCallback = cb
                return fakeWatcher as unknown as fs.FSWatcher & EventEmitter
            }
        )

        await Promise.race([startWatch(undefined, true), wait(50)])

        const callsBefore = mockGenerate.mock.calls.length

        capturedCallback?.('change', null)
        await wait(400)

        expect(mockGenerate).toHaveBeenCalledTimes(callsBefore)

        spy.mockRestore()
    })

    it('registers a SIGINT handler for clean exit', async () => {
        const { restore } = mockFsWatch()
        const onSpy = vi.spyOn(process, 'on')

        await Promise.race([startWatch(undefined, true), wait(50)])

        expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))

        onSpy.mockRestore()
        restore()
    })
})