precision highp float;

out vec4 fragColor;
in vec2 uv;
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;

void main() {
  fragColor = texture(colorTexture, uv);
  gl_FragDepth = texture(depthTexture, uv).r;
}
