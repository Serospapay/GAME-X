"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Monitor,
  Map,
  Crown,
  CreditCard,
  Trophy,
  User,
} from "lucide-react";

const actions = [
  {
    id: "book",
    href: "#booking-map",
    icon: Monitor,
    label: "Забронювати ПК",
    desc: "Обери вільне місце",
    gradient: "from-cyan-500/20 to-cyan-500/5",
    border: "border-cyan-500/40",
    hover: "hover:border-cyan-400/60 hover:shadow-[0_0_25px_rgba(6,182,212,0.15)]",
  },
  {
    id: "map",
    href: "#booking-map",
    icon: Map,
    label: "Жива карта",
    desc: "Статус усіх ПК",
    gradient: "from-emerald-500/20 to-emerald-500/5",
    border: "border-emerald-500/40",
    hover: "hover:border-emerald-400/60 hover:shadow-[0_0_25px_rgba(16,185,129,0.15)]",
  },
  {
    id: "vip",
    href: "#tariffs",
    icon: Crown,
    label: "VIP зали",
    desc: "Преміум обладнання",
    gradient: "from-amber-500/20 to-amber-500/5",
    border: "border-amber-500/40",
    hover: "hover:border-amber-400/60 hover:shadow-[0_0_25px_rgba(245,158,11,0.15)]",
  },
  {
    id: "tariffs",
    href: "#tariffs",
    icon: CreditCard,
    label: "Тарифи",
    desc: "Ціни за годину",
    gradient: "from-violet-500/20 to-violet-500/5",
    border: "border-violet-500/40",
    hover: "hover:border-violet-400/60 hover:shadow-[0_0_25px_rgba(139,92,246,0.15)]",
  },
  {
    id: "profile",
    href: "/profile",
    icon: User,
    label: "Профіль",
    desc: "Мої бронювання",
    gradient: "from-neutral-500/20 to-neutral-500/5",
    border: "border-neutral-500/40",
    hover: "hover:border-neutral-400/60",
    authOnly: true,
  },
];

export default function QuickActions() {
  const { data: session } = useSession();

  const visibleActions = actions.filter(
    (a) => !a.authOnly || (a.authOnly && session?.user)
  );

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {visibleActions.map((action, i) => {
        const Icon = action.icon;
        const content = (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className={`
              group flex flex-col items-start rounded-xl border-2 p-5
              bg-gradient-to-br ${action.gradient} ${action.border}
              transition-all duration-300 ${action.hover}
            `}
          >
            <div className="mb-3 rounded-lg border border-white/10 bg-white/5 p-2.5">
              <Icon className="h-6 w-6 text-white/90" strokeWidth={1.5} />
            </div>
            <p className="font-semibold text-white">{action.label}</p>
            <p className="mt-0.5 text-xs text-neutral-400">{action.desc}</p>
          </motion.div>
        );

        return action.href.startsWith("#") ? (
          <a key={action.id} href={action.href}>
            {content}
          </a>
        ) : (
          <Link key={action.id} href={action.href}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}
