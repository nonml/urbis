// Frame capture for evidence. Reads the drawing buffer directly: a 2D drawImage
// of the WebGL canvas returns black unless preserveDrawingBuffer is on, and paying
// that cost on every frame to serve a test would be the wrong trade.
// Must run in the same task as the render, before the buffer is cleared.
export function captureFrame(renderer) {
    const gl = renderer.getContext();
    const { width, height } = renderer.domElement;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(width, height);

    // readPixels is bottom-up, ImageData is top-down.
    const stride = width * 4;
    for (let y = 0; y < height; y++) {
        const src = (height - 1 - y) * stride;
        image.data.set(pixels.subarray(src, src + stride), y * stride);
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
}
