import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { reviewerTesterFilter } from './demoWorkspace.js';

export async function reviewerTesterIds(reviewer: any) {
  const testers: any[] = await User.find({ role: 'TESTER', isActive: true, ...reviewerTesterFilter(reviewer) }).select('_id').lean();
  return testers.map(tester => tester._id);
}

export function reviewerReportOwnerFilter(testerIds: unknown[], requestedTesterId?: string) {
  const ids = requestedTesterId && mongoose.isValidObjectId(requestedTesterId)
    ? testerIds.filter(id => String(id) === requestedTesterId)
    : requestedTesterId ? [] : testerIds;
  if (!ids.length) return { _id: { $exists: false } };
  return { $or: [{ testerId: { $in: ids } }, { submittedBy: { $in: ids } }] };
}

export function reviewerCanSelectTester(testerIds: unknown[], requestedTesterId: string) {
  return mongoose.isValidObjectId(requestedTesterId) && testerIds.some(id => String(id) === requestedTesterId);
}
