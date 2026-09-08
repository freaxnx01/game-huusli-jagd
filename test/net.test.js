import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { encodeDescription, decodeDescription, parseMessage, createHost, createGuest } from '../src/net/webrtc.js';

const SDP = [
  'v=0',
  'o=- 4611731400430051336 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=ice-ufrag:abcd',
  'a=ice-pwd:0123456789abcdef0123456789',
  'a=fingerprint:sha-256 00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF',
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=candidate:1 1 udp 2113937151 192.168.1.10 54321 typ host',
  '',
].join('\r\n');

describe('offer/answer codes', () => {
  test('round-trips an offer through the deflate path', async () => {
    const code = await encodeDescription({ type: 'offer', sdp: SDP });
    assert.match(code, /^HJ1\.[A-Za-z0-9+/=]+$/);
    assert.ok(code.length < SDP.length, 'deflate should shrink the SDP');
    assert.deepEqual(await decodeDescription(code), { type: 'offer', sdp: SDP });
  });

  test('round-trips an answer', async () => {
    const code = await encodeDescription({ type: 'answer', sdp: SDP });
    assert.deepEqual(await decodeDescription(code), { type: 'answer', sdp: SDP });
  });

  test('decodes the plain HJ0 fallback', async () => {
    const raw = JSON.stringify({ t: 'answer', s: SDP });
    const code = 'HJ0.' + Buffer.from(raw, 'utf8').toString('base64');
    assert.deepEqual(await decodeDescription(code), { type: 'answer', sdp: SDP });
  });

  test('tolerates whitespace and newlines pasted around and inside the code', async () => {
    const code = await encodeDescription({ type: 'offer', sdp: SDP });
    const mangled = '  \n\t' + code.slice(0, 10) + '\n' + code.slice(10, 40) + ' \r\n ' + code.slice(40) + '\n\n';
    assert.deepEqual(await decodeDescription(mangled), { type: 'offer', sdp: SDP });
  });

  test('rejects garbage with Error("bad code")', async () => {
    const cases = [
      '',
      null,
      undefined,
      'hello',
      'TS1.abcd',               // the Tschau Sepp prefix, not ours
      'HJ2.abcd',
      'HJ1.',
      'HJ1.!!!not base64!!!',
      'HJ1.' + Buffer.from('not deflate').toString('base64'),
      'HJ0.' + Buffer.from('not json').toString('base64'),
      'HJ0.' + Buffer.from(JSON.stringify({ t: 'offer' })).toString('base64'),        // missing sdp
      'HJ0.' + Buffer.from(JSON.stringify({ t: 'bogus', s: 'x' })).toString('base64'), // bad type
      'HJ0.' + Buffer.from(JSON.stringify([1, 2])).toString('base64'),
    ];
    for (const c of cases) {
      await assert.rejects(decodeDescription(c), { message: 'bad code' }, `case ${JSON.stringify(c)}`);
    }
  });
});

describe('parseMessage', () => {
  test('accepts a plain object with a string t', () => {
    assert.deepEqual(parseMessage('{"t":"hello","name":"Anna","custom":true}'), { t: 'hello', name: 'Anna', custom: true });
    assert.deepEqual(parseMessage('{"t":"act","action":{"type":"ROLL"}}'), { t: 'act', action: { type: 'ROLL' } });
  });

  test('drops everything else', () => {
    const bad = [
      'not json',
      '',
      'null',
      '42',
      '"string"',
      'true',
      '[]',
      '["t"]',
      '{}',
      '{"type":"hello"}',
      '{"t":1}',
      '{"t":null}',
      '{"t":""}',
      '{"t":["hello"]}',
      '{"t":{"x":1}}',
      undefined,
      null,
      123,
      { t: 'hello' },
      new Uint8Array([1, 2, 3]),
    ];
    for (const raw of bad) assert.equal(parseMessage(raw), null, `raw ${String(raw)}`);
  });

  test('never throws, even on prototype-pollution-shaped payloads', () => {
    const msg = parseMessage('{"t":"x","__proto__":{"polluted":true}}');
    assert.equal(msg.t, 'x');
    assert.equal({}.polluted, undefined);
  });
});

describe('host without WebRTC (pure parts only)', () => {
  test('starts empty, send/broadcast are no-ops, close is idempotent', () => {
    const host = createHost();
    assert.deepEqual(host.guests(), []);
    assert.equal(host.send(1, { t: 'x' }), false);
    host.broadcast({ t: 'x' });
    host.close(1);
    host.closeAll();
    host.closeAll();
  });

  test('acceptAnswer rejects non-answer codes and codes without a pending offer', async () => {
    const host = createHost();
    await assert.rejects(host.acceptAnswer('garbage'), { message: 'bad code' });
    const offer = await encodeDescription({ type: 'offer', sdp: SDP });
    await assert.rejects(host.acceptAnswer(offer), { message: 'not an answer code' });
    const answer = await encodeDescription({ type: 'answer', sdp: SDP });
    await assert.rejects(host.acceptAnswer(answer), { message: 'no pending offer' });
  });

  test('makeOfferCode fails readably when RTCPeerConnection is missing', async () => {
    const host = createHost();
    await assert.rejects(host.makeOfferCode(), /WebRTC is not available/);
    host.closeAll();
    await assert.rejects(host.makeOfferCode(), { message: 'host is closed' });
  });

  test('on() returns an unsubscribe function and closeAll removes listeners', () => {
    const host = createHost();
    let calls = 0;
    const off = host.on('connected', () => calls++);
    assert.equal(typeof off, 'function');
    off();
    host.closeAll();
    assert.equal(calls, 0);
  });
});

describe('guest without WebRTC (pure parts only)', () => {
  test('answerOffer rejects non-offer codes before touching WebRTC', async () => {
    const guest = createGuest();
    await assert.rejects(guest.answerOffer('  nope  '), { message: 'bad code' });
    const answer = await encodeDescription({ type: 'answer', sdp: SDP });
    await assert.rejects(guest.answerOffer(answer), { message: 'not an offer code' });
    const offer = await encodeDescription({ type: 'offer', sdp: SDP });
    await assert.rejects(guest.answerOffer(offer), /WebRTC is not available/);
  });

  test('send is a no-op when unconnected and close is idempotent', async () => {
    const guest = createGuest();
    assert.equal(guest.send({ t: 'hello' }), false);
    guest.close();
    guest.close();
    const offer = await encodeDescription({ type: 'offer', sdp: SDP });
    await assert.rejects(guest.answerOffer(offer), { message: 'guest is closed' });
  });
});
