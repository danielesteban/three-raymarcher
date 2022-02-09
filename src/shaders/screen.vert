out vec2 uv;
in vec3 position;

void main() {
  gl_Position = vec4(position.xy, 0, 1);
  uv = position.xy * 0.5 + 0.5;
}
