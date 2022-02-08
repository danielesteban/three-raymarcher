import path from 'path';

export default {
  external: ['three'],
  input: path.join(__dirname, 'raymarcher.js'),
  output: {
    file: path.resolve(__dirname, '..', 'module.js'),
    format: 'esm',
  },
  plugins: [
    {
      name: 'shaders',
      transform(code, id) {
        if (/\.(frag|vert)$/g.test(id)) {
          return {
            code: `export default ${JSON.stringify(code)};`,
            map: { mappings: '' }
          };
        }
      }
    },
  ],
  watch: { clearScreen: false },
};
