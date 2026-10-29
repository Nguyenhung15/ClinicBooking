const { getNextSequence } = require('../counter.model');

/**
 * Reusable Mongoose plugin that:
 * 1. Adds numeric auto-increment `id: Number` compatible with SQL & Frontend `Number(raw.id)`
 * 2. Strips internal MongoDB fields (`_id`, `__v`) and any `hiddenFields` when serializing
 */
function baseSchemaPlugin(schema, options = {}) {
  const { sequenceName, hiddenFields = [], extraTransform } = options;

  if (!sequenceName) {
    throw new Error('baseSchemaPlugin requires options.sequenceName');
  }

  schema.add({
    id: {
      type: Number,
      unique: true,
      index: true,
    },
  });

  schema.pre('validate', async function assignNumericId() {
    if (this.isNew && (this.id === undefined || this.id === null)) {
      this.id = await getNextSequence(sequenceName);
    }
  });

  const transformDoc = (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    for (const field of hiddenFields) {
      delete ret[field];
    }
    if (typeof extraTransform === 'function') {
      return extraTransform(doc, ret) || ret;
    }
    return ret;
  };

  schema.set('toJSON', { virtuals: true, transform: transformDoc });
  schema.set('toObject', { virtuals: true, transform: transformDoc });
}

module.exports = baseSchemaPlugin;

