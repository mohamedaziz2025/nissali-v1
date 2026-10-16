import mongoose from 'mongoose';

const { Schema } = mongoose;

// Messagerie utilisatrice ↔ praticienne : texte, photos, réponses citées, réactions, signalement et blocage.
// RG-27 : un rappel invite à ne pas partager d'informations médicales sensibles.
const conversationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    practitioner: { type: Schema.Types.ObjectId, ref: 'Practitioner', required: true, index: true },
    lastMessage: { text: String, from: { type: String, enum: ['user', 'pro'] }, at: Date },
    unreadUser: { type: Number, default: 0 },
    unreadPro: { type: Number, default: 0 },
    readUserAt: Date,
    readProAt: Date,
    // « Reçu » : l'appli de la destinataire a récupéré les messages (ouverte, même sans lire la conversation).
    deliveredUserAt: Date,
    deliveredProAt: Date,
    typingUserAt: Date,
    typingProAt: Date,
    blockedByUser: { type: Boolean, default: false },
    blockedByPro: { type: Boolean, default: false },
    reports: [{ by: { type: String, enum: ['user', 'pro'] }, reason: String, at: Date, handled: { type: Boolean, default: false } }],
  },
  { timestamps: true },
);
conversationSchema.index({ user: 1, practitioner: 1 }, { unique: true });

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    from: { type: String, enum: ['user', 'pro'], required: true },
    text: { type: String, default: '', maxlength: 2000 },
    // Photo (stockage privé, servie par lien signé temporaire).
    image: { storedName: String, width: Number, height: Number },
    replyTo: { type: Schema.Types.ObjectId, ref: 'Message' },
    reactions: [{ _id: false, by: { type: String, enum: ['user', 'pro'] }, emoji: String }],
    // « Retirer pour tout le monde » (contenu effacé) ou « Supprimer pour moi » (masqué d'un côté).
    deletedForAll: { type: Boolean, default: false },
    hiddenFor: { type: [String], default: [] },
  },
  { timestamps: true },
);
messageSchema.index({ conversation: 1, updatedAt: -1 });
messageSchema.index({ conversation: 1, createdAt: -1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);
export const Message = mongoose.model('Message', messageSchema);
