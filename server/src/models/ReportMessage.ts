import { Schema, model } from 'mongoose';

const reportMessageSchema = new Schema({
  reportId: { type: Schema.Types.ObjectId, ref: 'TestReport', required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  senderNameSnapshot: { type: String, required: true },
  senderRole: { type: String, required: true },
  recipientRole: { type: String, default: 'REVIEWER' },
  subject: { type: String, required: true, trim: true, maxlength: 200 },
  message: { type: String, required: true, trim: true, maxlength: 10000 },
  readAt: Date,
}, { timestamps: true, collection: 'reportMessages' });

reportMessageSchema.index({ reportId: 1, createdAt: 1 });

export const ReportMessage = model('ReportMessage', reportMessageSchema);
