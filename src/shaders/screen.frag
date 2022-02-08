precision highp float;

out vec4 fragColor;
in vec2 fragUV;
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;

void main() {
  fragColor = texture(colorTexture, fragUV);
  gl_FragDepth = texture(depthTexture, fragUV).r;
}
