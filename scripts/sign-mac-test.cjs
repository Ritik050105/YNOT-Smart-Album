// Local testing only: an ad-hoc signature is not an Apple Developer ID signature.
module.exports = options => require('@electron/osx-sign').signAsync({
  ...options, identity: '-', identityValidation: false, gatekeeperAssess: false,
  optionsForFile: file => ({ ...options.optionsForFile?.(file), timestamp: 'none' }),
});
