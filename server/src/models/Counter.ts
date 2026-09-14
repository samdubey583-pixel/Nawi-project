import { Schema, model } from 'mongoose';
const counterSchema = new Schema({ _id: String, value: { type: Number, default: 0 } }, { collection: 'counters' });
export const Counter = model('Counter', counterSchema);
