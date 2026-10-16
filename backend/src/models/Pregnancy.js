import mongoose from 'mongoose';

const { Schema } = mongoose;

const pregnancySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['active', 'naissance', 'fausse_couche', 'arretee'], default: 'active' },
    lmp: String, // DDR
    conceptionDate: String, // DG
    dueDate: String, // terme donné par l'échographie ou la sage-femme
    echoDate: String,
    cycleLength: { type: Number, default: 28 },
    endedOn: String,
  },
  { timestamps: true },
);

export const Pregnancy = mongoose.model('Pregnancy', pregnancySchema);
