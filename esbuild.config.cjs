const esbuild = require('esbuild');

const isWatch = process.argv.includes('--watch');

const commonConfig = {
  bundle: true,
  minify: !isWatch,
  sourcemap: isWatch,
  external: ['react', 'react-dom', '@paperclipai/plugin-sdk'],
  outdir: 'dist',
};

const entryPoints = [
  'src/manifest.ts',
  'src/worker.ts',
  'src/ui/index.tsx',
];

async function build() {
  const ctx = await esbuild.context({
    ...commonConfig,
    entryPoints,
    format: 'esm',
    platform: 'browser',
    define: {
      'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
    },
  });

  if (isWatch) {
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
