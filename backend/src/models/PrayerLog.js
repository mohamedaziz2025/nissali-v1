import mongoose from 'mongoose';

const { Schema } = mongoose;

const prayerLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true },
    fajr: { type: Boolean, default: false },
    dhuhr: { type: Boolean, default: false },
    asr: { type: Boolean, default: false },
    maghrib: { type: Boolean, default: false },
    isha: { type: Boolean, default: false },
  },
  { timestamps: true },
);

prayerLogSchema.index({ user: 1, day: 1 }, { unique: true });

export const PrayerLog = mongoose.model('PrayerLog', prayerLogSchema);
