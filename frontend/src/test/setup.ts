import '@testing-library/jest-dom/vitest'

// Mock ResizeObserver for JSDOM
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = window.ResizeObserver || MockResizeObserver
globalThis.ResizeObserver = globalThis.ResizeObserver || MockResizeObserver

// Mock matchMedia for JSDOM
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// Mock HTMLCanvasElement.prototype.getContext for JSDOM
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() => ({
    fillRect: () => {},
    clearRect: () => {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: () => {},
    createImageData: () => [],
    setTransform: () => {},
    drawImage: () => {},
    save: () => {},
    fillText: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    measureText: () => ({ width: 0 }),
    transform: () => {},
    resetTransform: () => {},
    canvas: { width: 300, height: 150 },
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext
}

