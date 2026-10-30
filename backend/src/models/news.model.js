const mongoose = require('mongoose');
const baseSchemaPlugin = require('./plugins/baseSchema.plugin');

const newsSchema = new mongoose.Schema(
  {
    sourceId: {
      type: Number,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    link: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 1000,
      index: true,
    },
    summary: {
      type: String,
      default: '',
      maxlength: 5000,
    },
    image: {
      type: String,
      default: null,
      maxlength: 1000,
    },
    pubDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

newsSchema.index({ sourceId: 1, pubDate: -1, id: -1 });
newsSchema.index({ pubDate: -1, id: -1 });

newsSchema.plugin(baseSchemaPlugin, {
  sequenceName: 'news',
});

const News = mongoose.model('News', newsSchema, 'news');

module.exports = News;

