/// <reference types="jest" />

import * as utils from '../lib/utils';

describe('utils', () => {
  describe('deepAssign', () => {
    it('should deeply merge two objects', async () => {
      const objectA = {
        hello: 'test',
        a: 'a',
        obj: {
          x: 1,
          arr: [1, 2, [42]]
        }
      };
      const objectB = {
        hello: 'world',
        b: 'b',
        obj: {
          y: 2,
          arr: [3, 4, [42]]
        }
      };
      const merged = {
        hello: 'world',
        a: 'a',
        b: 'b',
        obj: {
          x: 1,
          y: 2,
          arr: [1, 2, [42], 3, 4, [42]]
        }
      };
      expect(utils.deepAssign({}, objectA, objectB)).toEqual(merged);
    });
  });

  describe('walkDirectory', () => {
    it('should walk a directory recursively', async () => {
      const collectedPaths: string[] = [];
      const filePaths = await utils.walkDirectory(__dirname, async filePath => {
        collectedPaths.push(filePath);
      });
      expect(filePaths.length).toEqual(4); // there are 4 files in this directory
      expect(filePaths.sort()).toEqual(collectedPaths.sort());
    });
  });
});
