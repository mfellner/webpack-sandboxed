// @flow

import path from 'path'
import * as memoryfs from '../lib/memory-fs'

describe('memory-fs', () => {
  it('should create an empty memory file-system', async () => {
    const memfs = await memoryfs.createInstance({root: '/'})
    const files = memfs.readdirSync('/')
    expect(files.length).toBe(0)
  })

  it('should create a memory file-system with the given packages', async () => {
    const memfs = await memoryfs.createInstance({packages: ['memory-fs'], root: '/'})

    let files = memfs.readdirSync('/node_modules')
    expect(files.length).toBeGreaterThan(1) // memory-fs has dependencies
    expect(files).toContain('memory-fs')    // memory-fs should be one of the packges

    files = memfs.readdirSync('/node_modules/memory-fs/lib')
    expect(files).toContain('MemoryFileSystem.js')
  })

  it('should create a memory file-system with the given files', async () => {
    const includes = [path.resolve(__dirname, '../test')]
    const memfs = await memoryfs.createInstance({includes, root: '/'})

    let files = memfs.readdirSync('/')
    expect(files.length).toBe(1)
    expect(files).toContain('test')

    files = memfs.readdirSync('/test')
    expect(files.length).toBeGreaterThan(1)
    expect(files).toContain('memory-fs.test.js')

    files = memfs.readdirSync('/test/__snapshots__')
    expect(files.length).toBeGreaterThan(0)
  })
})
