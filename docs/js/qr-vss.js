(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HideAndSeenVss = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function pack(mask) {
    const height = mask.length;
    const width = height ? mask[0].length : 0;
    if (!width || width > 255 || height > 255)
      throw new Error("share image dimensions must be between 1 and 255");
    if (mask.some(row => row.length !== width))
      throw new Error("share image rows must have equal width");
    const bytes = new Uint8Array(Math.ceil(width * height / 8));
    let position = 0;
    mask.forEach(row => row.forEach(value => {
      if (value) bytes[Math.floor(position / 8)] |= 1 << (7 - (position % 8));
      position += 1;
    }));
    return { width, height, bytes };
  }

  function unpack(bytes, width, height) {
    if (bytes.length < Math.ceil(width * height / 8))
      throw new Error("share payload is shorter than its declared dimensions");
    const mask = [];
    for (let row = 0; row < height; row += 1) {
      const values = [];
      for (let column = 0; column < width; column += 1) {
        const position = row * width + column;
        values.push((bytes[Math.floor(position / 8)] >> (7 - (position % 8))) & 1);
      }
      mask.push(values);
    }
    return mask;
  }

  function secureRandom(length) {
    if (!globalThis.crypto || !globalThis.crypto.getRandomValues)
      throw new Error("secure random generator is unavailable");
    const bytes = new Uint8Array(length);
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }

  function create(mask, randomBytes) {
    const secret = pack(mask);
    const first = randomBytes ? new Uint8Array(randomBytes) : secureRandom(secret.bytes.length);
    if (first.length !== secret.bytes.length)
      throw new Error("random share length does not match the packed image");
    const second = new Uint8Array(first.length);
    for (let index = 0; index < first.length; index += 1)
      second[index] = first[index] ^ secret.bytes[index];
    return { width: secret.width, height: secret.height, secret: secret.bytes, first, second };
  }

  function encodeShare(width, height, bytes) {
    return new Uint8Array([width, height, ...bytes]);
  }

  function decodeShare(payload) {
    if (!payload || payload.length < 3) throw new Error("share payload is incomplete");
    const width = payload[0];
    const height = payload[1];
    const expected = Math.ceil(width * height / 8);
    if (payload.length !== expected + 2)
      throw new Error("share payload length does not match its dimensions");
    return { width, height, bytes: payload.slice(2) };
  }

  function combine(firstPayload, secondPayload) {
    const first = decodeShare(firstPayload);
    const second = decodeShare(secondPayload);
    if (first.width !== second.width || first.height !== second.height)
      throw new Error("share dimensions do not match");
    const bytes = new Uint8Array(first.bytes.length);
    for (let index = 0; index < bytes.length; index += 1)
      bytes[index] = first.bytes[index] ^ second.bytes[index];
    return { width: first.width, height: first.height, bytes,
      mask: unpack(bytes, first.width, first.height) };
  }

  return Object.freeze({ pack, unpack, create, encodeShare, decodeShare, combine });
});
