import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(
  new URL('../src/image-framing.ts', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { visibleBounds, getImageFrame } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

function pixels(width, height, bounds, alpha = 255) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  if (bounds) {
    for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
      for (let x = bounds.x; x < bounds.x + bounds.width; x++)
        rgba[(y * width + x) * 4 + 3] = alpha;
    }
  }
  return rgba;
}

test('transparent outer padding is removed with a protective content margin', () => {
  assert.deepEqual(
    visibleBounds(
      pixels(100, 80, { x: 20, y: 10, width: 60, height: 40 }),
      100,
      80,
    ),
    {
      x: 18,
      y: 8,
      width: 64,
      height: 44,
    },
  );
});

test('an opaque photograph and an entirely empty image use the unchanged fallback', () => {
  assert.equal(
    visibleBounds(
      pixels(100, 80, { x: 0, y: 0, width: 100, height: 80 }),
      100,
      80,
    ),
    undefined,
  );
  assert.equal(visibleBounds(pixels(100, 80), 100, 80), undefined);
});

test('transparency inside the picture does not crop visible content touching its edges', () => {
  const rgba = pixels(100, 80);
  for (const [x, y] of [
    [0, 0],
    [99, 79],
  ])
    rgba[(y * 100 + x) * 4 + 3] = 255;
  assert.equal(visibleBounds(rgba, 100, 80), undefined);
});

test('almost invisible alpha noise does not make padded content fill the canvas', () => {
  const rgba = pixels(100, 80, { x: 20, y: 10, width: 60, height: 40 });
  rgba[3] = 1;
  assert.deepEqual(visibleBounds(rgba, 100, 80), {
    x: 18,
    y: 8,
    width: 64,
    height: 44,
  });
  assert.deepEqual(
    visibleBounds(
      pixels(100, 80, { x: 20, y: 10, width: 60, height: 40 }, 2),
      100,
      80,
    ),
    {
      x: 18,
      y: 8,
      width: 64,
      height: 44,
    },
  );
});

test('bounds remain inside the source image and malformed samples fail safely', () => {
  assert.deepEqual(
    visibleBounds(
      pixels(100, 80, { x: 0, y: 40, width: 80, height: 40 }),
      100,
      80,
    ),
    {
      x: 0,
      y: 37,
      width: 83,
      height: 43,
    },
  );
  assert.equal(visibleBounds([], 100, 80), undefined);
  assert.equal(visibleBounds([], 0, 80), undefined);
  assert.equal(visibleBounds([], 1.5, 80), undefined);
});

function imageFixture({
  naturalWidth = 1024,
  naturalHeight = 512,
  contextError,
  readError,
  noContext = false,
} = {}) {
  const canvas = { width: 0, height: 0 };
  const calls = [];
  canvas.getContext = (type, options) => {
    calls.push({ type, options });
    if (contextError) throw contextError;
    if (noContext) return null;
    return {
      drawImage(...args) {
        calls.push({ draw: args });
      },
      getImageData(x, y, width, height) {
        if (readError) throw readError;
        return {
          data: pixels(width, height, {
            x: Math.floor(width / 4),
            y: Math.floor(height / 4),
            width: Math.floor(width / 2),
            height: Math.floor(height / 2),
          }),
        };
      },
    };
  };
  const image = {
    naturalWidth,
    naturalHeight,
    complete: true,
    ownerDocument: {
      createElement(name) {
        assert.equal(name, 'canvas');
        return canvas;
      },
    },
  };
  return { image, canvas, calls };
}

test('sampling is bounded to 256 pixels and returns a source-pixel SVG viewBox', () => {
  const { image, canvas, calls } = imageFixture();
  const frame = getImageFrame(image);
  assert.equal(canvas.width, 256);
  assert.equal(canvas.height, 128);
  assert.deepEqual(calls[1].draw, [image, 0, 0, 256, 128]);
  assert.deepEqual(frame, {
    x: 240,
    y: 112,
    width: 544,
    height: 288,
    naturalWidth: 1024,
    naturalHeight: 512,
    viewBox: '240 112 544 288',
  });
});

test('small images are not enlarged for alpha analysis', () => {
  const { image, canvas } = imageFixture({
    naturalWidth: 80,
    naturalHeight: 60,
  });
  assert.ok(getImageFrame(image));
  assert.equal(canvas.width, 80);
  assert.equal(canvas.height, 60);
});

test('CORS-tainted, unreadable, absent canvas and unloaded images keep the normal image', () => {
  for (const options of [
    { readError: new DOMException('Tainted canvas', 'SecurityError') },
    { contextError: new Error('Canvas unavailable') },
    { noContext: true },
    { naturalWidth: 0 },
    { naturalHeight: NaN },
  ])
    assert.equal(getImageFrame(imageFixture(options).image), undefined);
  const { image } = imageFixture();
  image.complete = false;
  assert.equal(getImageFrame(image), undefined);
});
