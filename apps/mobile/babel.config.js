// AI CAGE Mobile — Babel config for Expo
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Resolve @ai-cage/core and @ai-cage/presidio-lite from workspace packages
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@ai-cage/core': '../../packages/core/src/index.ts',
            '@ai-cage/presidio-lite': '../../packages/presidio-lite/src/index.ts',
          },
        },
      ],
    ],
  };
};
