// Luminance-to-glyph post-processing, inspired by the supplied
// egorshest/webgl-ascii-hero reference. The 3D scene stays the same size;
// sampling resolution is one ray per 5 CSS px cell, independent of GPU quality.
export const ASCII_CELL_PX = 5;
export const asciiFragment = `
precision mediump float;
uniform sampler2D uScene;
uniform sampler2D uGlyphs;
uniform vec2 uScreen;
uniform vec2 uGrid;
uniform float uCell;
void main() {
  vec2 cell = floor(gl_FragCoord.xy / uCell);
  vec4 color = texture2D(uScene, (cell + 0.5) / uGrid);
  float luminance = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  float glyph = floor(clamp(pow(luminance, 0.58) * 9.0, 0.0, 9.0));
  vec2 local = fract(gl_FragCoord.xy / uCell);
  float ink = texture2D(uGlyphs, vec2((glyph + local.x) / 10.0, 1.0-local.y)).r;
  vec3 tint = mix(vec3(0.04, 0.5, 0.22), color.rgb * 1.8, 0.8);
  gl_FragColor = vec4(tint * ink, max(color.a * 0.32, ink * step(0.012, luminance)));
}`;

export function glyphAtlas(): HTMLCanvasElement {
  const atlas = document.createElement("canvas");
  atlas.width = 80; atlas.height = 8;
  const ctx = atlas.getContext("2d")!;
  ctx.fillStyle = "black"; ctx.fillRect(0, 0, 80, 8);
  ctx.fillStyle = "white"; ctx.font = "8px monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  [..." .:-=+*#%@"].forEach((c, i) => ctx.fillText(c, i * 8 + 4, 4));
  return atlas;
}
