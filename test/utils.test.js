// @flow

import * as utils from '../lib/utils'

describe('utils', () => {
  describe('stringify', () => {
    it('should stringify a complext object', async () => {
      const object = {
        hello: 'world',
        regex: /^foobar$/,
        obj: {
          arr: [1, 2, {test: true}]
        }
      }
      expect(utils.stringify(object)).toMatchSnapshot()
    })

    it('should escape special strings', async () => {
      const object = {
        foo: '@variable'
      }
      expect(utils.stringify(object, '@')).toBe('{foo: variable}')
    })
  })

  describe('deepAssign', () => {
    it('should deeply merge two objects', async () => {
      const objectA = {
        hello: 'test',
        a: 'a',
        obj: {
          x: 1,
          arr: [1, 2, [42]]
        }
      }
      const objectB = {
        hello: 'world',
        b: 'b',
        obj: {
          y: 2,
          arr: [3, 4, [42]]
        }
      }
      const merged = {
        hello: 'world',
        a: 'a',
        b: 'b',
        obj: {
          x: 1,
          y: 2,
          arr: [1, 2, [42], 3, 4, [42]]
        }
      }
      expect(utils.deepAssign({}, objectA, objectB)).toEqual(merged)
    })
  })
})
