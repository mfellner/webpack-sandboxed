import * as memoryfs from '../src/memory-fs'

describe('memory-fs', () => {
  it('should create an empty memory file-system', async () => {
    const memfs = await memoryfs.createInstance()
    const files = memfs.readdirSync('/')
    expect(files.length).toBe(0)
  })

  it('should create a memory file-system with the given packages', async () => {
    const memfs = await memoryfs.createInstance(['memory-fs'])
    const files = memfs.readdirSync('/node_modules')
    expect(files.length).toBeGreaterThan(1) // memory-fs has dependencies
    expect(files).toContain('memory-fs')    // memory-fs should be one of the packges
  })
})
