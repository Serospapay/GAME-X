import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth-guard";
import { getPolicy, RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policy";
import { checkRoleRateLimit, getIpKey } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/admin";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Computer } from "@/models/Computer";

interface UserSummary {
  role: "user";
  name: string;
  activeBookings: number;
  completedBookings: number;
  totalSpent: number;
  preferredType: string | null;
  lastBookedComputer: string | null;
}

interface AdminSummary {
  role: "admin";
  name: string;
  totalComputers: number;
  freeComputers: number;
  busyComputers: number;
  repairComputers: number;
  activeSessions: number;
  occupancyRate: number;
  alerts: string[];
}

type PersonalizationResponse = UserSummary | AdminSummary;

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  const { session } = auth;
  const identityKey = session.user.email ?? session.user.id ?? getIpKey(request);
  const rate = checkRoleRateLimit(
    "personalization",
    "user",
    identityKey,
    getPolicy(RATE_LIMIT_POLICIES.personalization, "user")
  );
  if (!rate.allowed) {
    return fail(
      `Забагато запитів. Повторіть через ${rate.retryAfterSec} с.`,
      429,
      "RATE_LIMITED"
    );
  }

  await connectDB();

  const name = session.user.name ?? "Гравець";
  const userEmail = session.user.email ?? "";
  const adminMode = isAdmin(userEmail);

  if (adminMode) {
    const [totalComputers, freeComputers, busyComputers, repairComputers, activeSessions] =
      await Promise.all([
        Computer.countDocuments({}),
        Computer.countDocuments({ status: "вільний" }),
        Computer.countDocuments({ status: "зайнятий" }),
        Computer.countDocuments({ status: "ремонт" }),
        Booking.countDocuments({ isCompleted: { $ne: true } }),
      ]);

    const occupancyRate =
      totalComputers > 0 ? Math.round((busyComputers / totalComputers) * 100) : 0;
    const alerts: string[] = [];
    if (repairComputers >= 3) {
      alerts.push(`У ремонті ${repairComputers} ПК — перевірте технічний стан залу.`);
    }
    if (occupancyRate >= 80) {
      alerts.push(`Зал завантажений на ${occupancyRate}% — час підсилити чергових адміністраторів.`);
    }
    if (freeComputers <= 2) {
      alerts.push("Зал майже заповнений — оновіть промо для VIP/PS5 слотів.");
    }

    const payload: PersonalizationResponse = {
      role: "admin",
      name,
      totalComputers,
      freeComputers,
      busyComputers,
      repairComputers,
      activeSessions,
      occupancyRate,
      alerts,
    };

    return ok(payload);
  }

  const filters: Array<Record<string, unknown>> = [];
  if (session.user.id && mongoose.Types.ObjectId.isValid(session.user.id)) {
    filters.push({ clientId: new mongoose.Types.ObjectId(session.user.id) });
  }
  if (userEmail) {
    filters.push({ clientEmail: userEmail });
  }
  if (filters.length === 0) {
    filters.push({ _id: null });
  }

  const ownerQuery = filters.length === 1 ? filters[0] : { $or: filters };

  const ownerMatch = ownerQuery as Record<string, unknown>;

  const [activeBookings, completedStats, preferredTypeAgg, latestBooking] = await Promise.all([
    Booking.countDocuments({ ...ownerQuery, isCompleted: { $ne: true } }),
    Booking.aggregate<{ _id: null; count: number; totalSpent: number }>([
      { $match: { ...ownerQuery, isCompleted: true } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalSpent: { $sum: "$totalAmount" },
        },
      },
    ]),
    Booking.aggregate<{ _id: string; count: number }>([
      { $match: ownerMatch },
      {
        $lookup: {
          from: "computers",
          localField: "computer",
          foreignField: "_id",
          as: "computerInfo",
        },
      },
      { $unwind: { path: "$computerInfo", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: "$computerInfo.type",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]),
    Booking.findOne(ownerMatch)
      .sort({ startTime: -1 })
      .populate("computer", "name")
      .lean(),
  ]);

  const completedBookings = completedStats[0]?.count ?? 0;
  const totalSpent = completedStats[0]?.totalSpent ?? 0;
  const preferredType = preferredTypeAgg[0]?._id ?? null;
  const lastBookedComputer =
    (latestBooking?.computer as { name?: string } | undefined)?.name ?? null;

  const payload: PersonalizationResponse = {
    role: "user",
    name,
    activeBookings,
    completedBookings,
    totalSpent,
    preferredType,
    lastBookedComputer,
  };

  return ok(payload);
}
