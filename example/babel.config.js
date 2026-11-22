module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo adds the react-native-worklets plugin itself.
  return { presets: ['babel-preset-expo'] };
};
