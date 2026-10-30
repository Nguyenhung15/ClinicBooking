const mongoose = require('mongoose');
const baseSchemaPlugin = require('./plugins/baseSchema.plugin');
const { RSS_SOURCE_STATUSES } = require('../constants/enums');

const rssSourceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    url: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 500,
      index: true,
    },
    category: {
      type: String,
      default: '',
      trim: true,
      maxlength: 50,
    },
    status: {
      type: String,
      enum: Object.values(RSS_SOURCE_STATUSES),
      default: RSS_SOURCE_STATUSES.ACTIVE,
      index: true,
    },
    createdBy: {
      type: Number,
      default: null,
    },
    updatedBy: {
      type: Number,
      default: null,
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
    lastSyncStatus: {
      type: String,
      enum: ['IDLE', 'SUCCESS', 'FAILED'],
      default: 'IDLE',
    },
    lastSyncError: {
      type: String,
      default: null,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  },
);

rssSourceSchema.plugin(baseSchemaPlugin, {
  sequenceName: 'rss_sources',
  extraTransform: (_doc, ret) => {
    ret.isEnabled = ret.status === RSS_SOURCE_STATUSES.ACTIVE;
    ret.enabled = ret.isEnabled;
    return ret;
  },
});

const RssSource = mongoose.model('RssSource', rssSourceSchema, 'rss_sources');

module.exports = RssSource;

