const { configService } = require('./config.service');

// Backward-compatible env object mirroring ConfigService properties
const env = new Proxy(configService.toObject(), {
  get(target, prop) {
    if (prop in configService) {
      return configService[prop];
    }
    return target[prop];
  },
});

module.exports = env;
