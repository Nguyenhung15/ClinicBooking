const mongoose = require('mongoose');
const baseSchemaPlugin = require('./plugins/baseSchema.plugin');

const imageSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      required: true,
    },
    doctorId: {
      type: Number,
      default: null,
      index: true,
    },
    specialtyId: {
      type: Number,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

imageSchema.plugin(baseSchemaPlugin, {
  sequenceName: 'images',
});

const Image = mongoose.model('Image', imageSchema, 'images');

module.exports = Image;

