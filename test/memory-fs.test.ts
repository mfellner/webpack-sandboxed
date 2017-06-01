/// <reference types="jest" />

import path = require('path');
import createMemoryFS from '../lib/memory-fs';

describe('memory-fs', () => {
  it('should create an empty memory file-system', async () => {
    const memfs = await createMemoryFS({ root: '/' });
    const files = memfs.readdirSync('/');
    expect(files.length).toBe(0);
  });

  it('should create a memory file-system with the given packages', async () => {
    const root = path.resolve('../', __dirname);
    const memfs = await createMemoryFS({
      packages: ['memory-fs'],
      root
    });

    let files = memfs.readdirSync(path.join(root, 'node_modules'));
    expect(files.length).toBeGreaterThan(1); // memory-fs has dependencies
    expect(files).toContain('memory-fs'); // memory-fs should be one of the packges

    files = memfs.readdirSync(path.join(root, 'node_modules/memory-fs/lib'));
    expect(files).toContain('MemoryFileSystem.js');
  });

  it('should create a memory file-system with the given files', async () => {
    const root = path.resolve('../', __dirname);
    const includes = [path.resolve(__dirname, '../test')];
    const memfs = await createMemoryFS({ includes, root });

    let files = memfs.readdirSync(root);
    expect(files.length).toBe(1);
    expect(files).toContain('includes');

    files = memfs.readdirSync(path.join(root, 'includes'));
    expect(files).toEqual(['test']);

    files = memfs.readdirSync(path.join(root, 'includes/test'));
    expect(files.length).toBeGreaterThan(1);
    expect(files).toContain(path.basename(__filename));

    files = memfs.readdirSync(path.join(root, 'includes/test/__snapshots__'));
    expect(files.length).toBeGreaterThan(0);
  });
});
