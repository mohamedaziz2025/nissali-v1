import mongoose from 'mongoose';

const { Schema } = mongoose;

// Traçabilité des actions du back-office (8.3).
const auditLogSchema = new Schema(
  {
    admin: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    target: String,
    meta: Schema.Types.Mixed,
  },
  { timestamps: true },
);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
