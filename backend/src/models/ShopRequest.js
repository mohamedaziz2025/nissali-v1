import mongoose from 'mongoose';

const { Schema } = mongoose;

// Lifestyle › NissaPlace : une sœur demande à ouvrir sa boutique sur nissaplace.fr, l'équipe valide avant de la recontacter.
const shopRequestSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    shopName: { type: String, required: true, trim: true, maxlength: 80 },
    activity: { type: String, default: '', maxlength: 120 }, // ex. abayas, hijabs, cosmétiques…
    description: { type: String, default: '', maxlength: 2000 },
    city: { type: String, default: '' },
    phone: { type: String, default: '' },
    instagramUrl: { type: String, default: '' },
    websiteUrl: { type: String, default: '' },
    status: { type: String, enum: ['en_attente', 'validee', 'refusee'], default: 'en_attente', index: true },
    moderationNote: String,
  },
  { timestamps: true },
);

export const ShopRequest = mongoose.model('ShopRequest', shopRequestSchema);
