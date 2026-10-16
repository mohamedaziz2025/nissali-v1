import mongoose from 'mongoose';

const { Schema } = mongoose;

// Paramètres religieux et techniques modifiables depuis le back-office (7.2), jamais codés en dur.
const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: Schema.Types.Mixed,
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

const settingHistorySchema = new Schema(
  {
    key: { type: String, required: true, index: true },
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    byName: String,
  },
  { timestamps: true },
);

export const Setting = mongoose.model('Setting', settingSchema);
export const SettingHistory = mongoose.model('SettingHistory', settingHistorySchema);
