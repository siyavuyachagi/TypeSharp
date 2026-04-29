/// <reference types="node" />

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../src/core/index.ts', () => ({
  generate: vi.fn(),
  loadConfig: vi.fn(),
}))

vi.mock('../../src/helpers/watcher.ts', () => ({
  watchDirectory: vi.fn(),
}))

import { startWatch } from '../../src/core/watch.ts'
import { generate, loadConfig } from '../../src/core/index.ts'
import { watchDirectory } from '../../src/helpers/watcher.ts'

const mockGenerate = vi.mocked(generate)
const mockLoadConfig = vi.mocked(loadConfig)
const mockWatchDirectory = vi.mocked(watchDirectory)

// ─── Helpers ────────────────────────────────────────────────────────────────

type WatchCallback = (event: string, filename: string | null) => void

function mockFsWatch(): { trigger: (filename: string) => void; triggerNull: () => void } {
  let capturedCallback: WatchCallback | null = null
  const fakeWatcher = { close: vi.fn() }

  mockWatchDirectory.mockImplementation((_dir: string, callback: WatchCallback) => {
    capturedCallback = callback
    return fakeWatcher as unknown as fs.FSWatcher
  })

  return {
    trigger: (filename: string) => capturedCallback?.('change', filename),
    triggerNull: () => capturedCallback?.('change', null),
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
    mockFsWatch()
    await Promise.race([startWatch(undefined, true), wait(100)])

    expect(mockGenerate).toHaveBeenCalledTimes(1)
    expect(mockGenerate).toHaveBeenCalledWith(undefined, true)
  })

  it('passes incremental=true to initial generate', async () => {
    mockFsWatch()
    await Promise.race([startWatch(undefined, true), wait(100)])

    expect(mockGenerate).toHaveBeenCalledWith(undefined, true)
  })

  it('passes incremental=false to initial generate when --no-incremental', async () => {
    mockFsWatch()
    await Promise.race([startWatch(undefined, false), wait(100)])

    expect(mockGenerate).toHaveBeenCalledWith(undefined, false)
  })

  it('triggers incremental generation after a file change', async () => {
    const { trigger } = mockFsWatch()
    await Promise.race([startWatch(undefined, true), wait(50)])

    trigger('src/pages/index.vue')
    await wait(400)

    expect(mockGenerate).toHaveBeenCalledTimes(2)
    expect(mockGenerate).toHaveBeenLastCalledWith(undefined, true)
  })

  it('debounces rapid file saves into a single generation', async () => {
    const { trigger } = mockFsWatch()
    await Promise.race([startWatch(undefined, true), wait(50)])

    trigger('src/pages/index.vue')
    trigger('src/pages/about.vue')
    trigger('src/components/Header.vue')
    trigger('src/components/Footer.vue')
    trigger('src/app.ts')
    await wait(400)

    expect(mockGenerate).toHaveBeenCalledTimes(2) // 1 initial + 1 debounced batch
  })

  it('ignores changes inside node_modules', async () => {
    const { trigger } = mockFsWatch()
    await Promise.race([startWatch(undefined, true), wait(50)])
    const callsBefore = mockGenerate.mock.calls.length

    trigger('node_modules/some-package/index.js')
    await wait(400)

    expect(mockGenerate).toHaveBeenCalledTimes(callsBefore)
  })

  it('ignores changes inside .nuxt', async () => {
    const { trigger } = mockFsWatch()
    await Promise.race([startWatch(undefined, true), wait(50)])
    const callsBefore = mockGenerate.mock.calls.length

    trigger('.nuxt/types/schema.d.ts')
    await wait(400)

    expect(mockGenerate).toHaveBeenCalledTimes(callsBefore)
  })

  it('ignores changes inside .next', async () => {
    const { trigger } = mockFsWatch()
    await Promise.race([startWatch(undefined, true), wait(50)])
    const callsBefore = mockGenerate.mock.calls.length

    trigger('.next/cache/webpack/client-production/0.pack')
    await wait(400)

    expect(mockGenerate).toHaveBeenCalledTimes(callsBefore)
  })

  it('ignores changes inside .git', async () => {
    const { trigger } = mockFsWatch()
    await Promise.race([startWatch(undefined, true), wait(50)])
    const callsBefore = mockGenerate.mock.calls.length

    trigger('.git/index')
    await wait(400)

    expect(mockGenerate).toHaveBeenCalledTimes(callsBefore)
  })

  it('ignores null filename events', async () => {
    const { triggerNull } = mockFsWatch()
    await Promise.race([startWatch(undefined, true), wait(50)])
    const callsBefore = mockGenerate.mock.calls.length

    triggerNull()
    await wait(400)

    expect(mockGenerate).toHaveBeenCalledTimes(callsBefore)
  })

  it('registers a SIGINT handler for clean exit', async () => {
    mockFsWatch()
    const onSpy = vi.spyOn(process, 'on')

    await Promise.race([startWatch(undefined, true), wait(50)])

    expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    onSpy.mockRestore()
  })
})