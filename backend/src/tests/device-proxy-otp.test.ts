import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MOBILE_DEVICE,
  buildIosMobileToken,
  buildIosMobileUserAgent,
  getCurrentAppVersion,
  getCurrentIosVersion,
  getMobileDevice,
  setAppVersion,
  setIosVersion,
} from '../config/device';
import { buildRegistrationFetchOptions } from '../config/proxyUtils';

const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

let originalAndroidVersion = getCurrentAppVersion();
let originalIosVersion = getCurrentIosVersion();

test.beforeEach(() => {
  originalAndroidVersion = getCurrentAppVersion();
  originalIosVersion = getCurrentIosVersion();
});

test.afterEach(() => {
  setAppVersion(originalAndroidVersion);
  setIosVersion(originalIosVersion);
});

test('DEFAULT_MOBILE_DEVICE is coherent with Android 15 fingerprint', () => {
  assert.equal(DEFAULT_MOBILE_DEVICE.osVersion, '15');
  assert.ok(DEFAULT_MOBILE_DEVICE.osBuildNumber.startsWith('BP'));
  const device = getMobileDevice();
  assert.equal(device.osVersion, '15');
  assert.equal(device.osBuildNumber, 'BP1A.250505.001');
});

test('Android and iOS runtime versions stay independent', () => {
  setAppVersion('1.1.1.1');
  setIosVersion('2.99.99.99');

  assert.equal(getMobileDevice().appVersion, '1.1.1.1');
  assert.equal(getCurrentIosVersion(), '2.99.99.99');
  assert.equal(getCurrentAppVersion(), '1.1.1.1');
});

test('iOS helper uses the iOS version, not the Android app version', () => {
  setIosVersion('2.99.00.00');
  setAppVersion('1.2.3.4');

  const userAgent = buildIosMobileUserAgent(getCurrentIosVersion());
  const token = buildIosMobileToken(getCurrentIosVersion());

  assert.match(userAgent, /2\.99\.00\.00/);
  assert.doesNotMatch(userAgent, /1\.2\.3\.4/);
  assert.ok(Buffer.isBuffer(token));
  assert.ok(token.length > 0);
});

test('buildRegistrationFetchOptions returns empty object without proxy', () => {
  assert.deepEqual(buildRegistrationFetchOptions('inst-1', null), {});
  assert.deepEqual(buildRegistrationFetchOptions('inst-1', undefined), {});
});

test('buildRegistrationFetchOptions ignores disabled proxy', () => {
  const result = buildRegistrationFetchOptions('inst-1', {
    enabled: false,
    host: '1.2.3.4',
    port: '8080',
    protocol: 'http',
    username: 'u',
    password: 'p',
  });

  assert.deepEqual(result, {});
});

test('buildRegistrationFetchOptions ignores proxy without username', () => {
  const result = buildRegistrationFetchOptions('inst-1', {
    enabled: true,
    host: '1.2.3.4',
    port: '8080',
    protocol: 'http',
    username: '',
    password: '',
  });

  assert.deepEqual(result, {});
});

test('buildRegistrationFetchOptions creates an HTTP proxy agent', () => {
  const result = buildRegistrationFetchOptions('inst-1', {
    enabled: true,
    host: '1.2.3.4',
    port: '8080',
    protocol: 'http',
    username: 'u',
    password: 'p',
    session: '',
  });

  assert.ok(result.httpsAgent instanceof HttpsProxyAgent);
  assert.ok(result.httpAgent instanceof HttpsProxyAgent);
});

test('buildRegistrationFetchOptions creates a SOCKS proxy agent', () => {
  const result = buildRegistrationFetchOptions('inst-1', {
    enabled: true,
    host: '1.2.3.4',
    port: '1080',
    protocol: 'socks5',
    username: 'u',
    password: 'p',
  });

  assert.ok(result.httpsAgent instanceof SocksProxyAgent);
  assert.ok(result.httpAgent instanceof SocksProxyAgent);
});
