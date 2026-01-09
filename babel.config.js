module.exports = function (api) {
    api.cache(true);
    return {
      presets: ['babel-preset-expo'],
      plugins: [
        [
          'module-resolver',
          {
            root: ['./'],
            extensions: ['.ts', '.tsx', '.js', '.json'],
            alias: { '@': './' },
          },
        ],
        // ⬇️ remplace 'react-native-reanimated/plugin' par :
        'react-native-worklets/plugin',
      ],
    };
  };
  