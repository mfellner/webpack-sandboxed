// @flow

import * as utils from '../lib/utils'

describe('utils', () => {
  describe('.stringify', () => {
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
})
