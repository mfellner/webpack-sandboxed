/// <reference types="jest" />

import WebpackRunner from '../lib/WebpackRunner';

describe('webpack', () => {
  it('should generate a JavaScript bundle', async () => {
    const runner = await WebpackRunner.createInstance();
    const [bundle, stats] = await runner.run('var x = 41 + 1;');

    expect(Object.keys(bundle).length).toBe(1);
    expect(Object.keys(bundle)[0]).toMatch(/^main.[a-z0-9]+\.js$/);
    expect(typeof bundle[Object.keys(bundle)[0]]).toBe('string');
    expect(typeof stats).toBe('object');

    expect(bundle[Object.keys(bundle)[0]]).toMatchSnapshot();
  });
});
