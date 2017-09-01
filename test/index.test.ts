/// <reference types="jest" />

import webpackSandboxed from '../lib';

describe('webpack-sandboxed', () => {
  it('should generate a JavaScript bundle', async () => {
    const runner = await webpackSandboxed();
    const [bundle, stats] = await runner.run('var x = 41 + 1;');
    const bundleKeys = Object.keys(bundle);

    expect(bundleKeys.length).toBe(1);
    expect(bundleKeys[0]).toMatch(/^main.[a-z0-9]+\.js$/);
    expect(bundle[bundleKeys[0]]).toBeInstanceOf(Buffer);
    expect(typeof stats).toBe('object');

    expect(bundle[bundleKeys[0]].toString()).toMatchSnapshot();
  });
});
