import mongoose, { Model, Schema, Types } from "mongoose";

type AuditActorRole = "system" | "admin" | "user";

export interface IAuditLogArchive {
  _id: Types.ObjectId;
  sourceLogId: string;
  actorEmail?: string;
  actorRole: AuditActorRole;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, string | number | boolean | null>;
  sourceCreatedAt?: Date;
  expiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const AuditLogArchiveSchema = new Schema<IAuditLogArchive>(
  {
    sourceLogId: { type: String, required: true, unique: true, index: true },
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
    sourceCreatedAt: { type: Date, required: false, index: true },
    expiresAt: { type: Date, required: false },
  },
  { timestamps: true }
);

AuditLogArchiveSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuditLogArchive: Model<IAuditLogArchive> =
  (mongoose.models.AuditLogArchive as Model<IAuditLogArchive>) ??
  mongoose.model<IAuditLogArchive>("AuditLogArchive", AuditLogArchiveSchema);
