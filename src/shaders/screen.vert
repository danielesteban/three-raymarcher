precision highp int;
precision highp float;

out vec2 fragUV;
in vec3 position;

void main() {
  fragUV = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0, 1);
}
