const mongoose = require('mongoose');
const baseSchemaPlugin = require('./plugins/baseSchema.plugin');

const specialtySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

specialtySchema.plugin(baseSchemaPlugin, {
  sequenceName: 'specialties',
});

const Specialty = mongoose.model('Specialty', specialtySchema, 'specialties');

module.exports = Specialty;

