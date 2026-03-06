import mongoose, { Model, Schema, Types } from "mongoose";

type AuditActorRole = "system" | "admin" | "user";

export interface IAuditLog {
  _id: Types.ObjectId;
  actorEmail?: string;
  actorRole: AuditActorRole;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, string | number | boolean | null>;
  expiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorEmail: { type: String, required: false, index: true },
    actorRole: {
      type: String,
      required: true,
      enum: ["system", "admin", "user"],
      default: "system",
      index: true,
    },
    action: { type: String, required: true, index: true },
    targetType: { type: String, required: true, index: true },
    targetId: { type: String, required: false },
    metadata: { type: Schema.Types.Mixed, required: false },
    expiresAt: { type: Date, required: false },
  },
  { timestamps: true }
);

AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ actorRole: 1, createdAt: -1 });
AuditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuditLog: Model<IAuditLog> =
  (mongoose.models.AuditLog as Model<IAuditLog>) ??
  mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
