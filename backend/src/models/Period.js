import mongoose from 'mongoose';

const { Schema } = mongoose;

const flowSchema = new Schema(
  {
    day: { type: String, required: true },
    level: { type: String, enum: ['traces', 'leger', 'moyen', 'abondant'], required: true },
  },
  { _id: false },
);

// Une période de saignement confirmée : règles (hayd) ou lochies (nifas).
const periodSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['hayd', 'nifas'], default: 'hayd' },
    start: { type: String, required: true }, // YYYY-MM-DD
    startTime: String, // HH:mm, facultatif
    end: String,
    endTime: String,
    flows: [flowSchema],
    symptoms: [String],
    cycleExcluded: { type: Boolean, default: false }, // cycle aberrant écarté après confirmation (6.2)
    source: { type: String, enum: ['saisie', 'accueil', 'historique'], default: 'saisie' },
  },
  { timestamps: true },
);

periodSchema.index({ user: 1, start: 1 });

periodSchema.methods.toPlain = function toPlain() {
  return {
    id: this.id,
    kind: this.kind,
    start: this.start,
    startTime: this.startTime,
    end: this.end,
    endTime: this.endTime,
    flows: this.flows.map((f) => ({ day: f.day, level: f.level })),
    symptoms: this.symptoms,
    cycleExcluded: this.cycleExcluded,
  };
};

export const Period = mongoose.model('Period', periodSchema);
