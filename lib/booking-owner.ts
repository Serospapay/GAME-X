import mongoose from "mongoose";

export type OwnerQuery = Record<string, unknown>;

export function buildBookingOwnerQuery(params: {
  userId?: string | null;
  email?: string | null;
}): OwnerQuery {
  const filters: OwnerQuery[] = [];

  if (params.userId && mongoose.Types.ObjectId.isValid(params.userId)) {
    filters.push({ clientId: new mongoose.Types.ObjectId(params.userId) });
  }

  if (params.email) {
    filters.push({ clientEmail: params.email });
  }

  if (filters.length === 0) {
    return { _id: null };
  }

  return filters.length === 1 ? filters[0] : { $or: filters };
}
