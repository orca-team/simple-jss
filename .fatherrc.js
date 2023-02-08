import { defineConfig } from 'father';

export default defineConfig({
  cjs: {
    input: 'src',
    output: './lib',
  },
  esm: {
    input: 'src',
    output: './esm',
  },
});
