const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

const Counter = mongoose.model('Counter', counterSchema, 'counters');

/**
 * Atomically increment and return next numeric ID for a given sequence name.
 */
async function getNextSequence(sequenceName) {
  const counter = await Counter.findByIdAndUpdate(
    sequenceName,
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true },
  );
  return counter.seq;
}

/**
 * Ensure sequence counter is at least `minValue` (useful after seeding fixed IDs).
 */
async function syncSequenceFloor(sequenceName, minValue) {
  const floor = Number(minValue) || 0;
  await Counter.findByIdAndUpdate(
    sequenceName,
    { $max: { seq: floor } },
    { upsert: true, returnDocument: 'after' },
  );
}

module.exports = {
  Counter,
  getNextSequence,
  syncSequenceFloor,
};
