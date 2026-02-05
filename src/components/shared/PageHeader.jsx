import React from "react";
import { motion } from "framer-motion";

export default function PageHeader({ icon: Icon, title, subtitle, color = "green" }) {
  const colorMap = {
    green: "from-green-500 to-emerald-600",
    blue: "from-blue-500 to-cyan-600",
    amber: "from-amber-500 to-orange-600",
    yellow: "from-yellow-500 to-amber-600",
    purple: "from-purple-500 to-violet-600",
    rose: "from-rose-500 to-pink-600",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 mb-8"
    >
      {Icon && (
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colorMap[color]} flex items-center justify-center shadow-lg shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      )}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-gray-500 text-sm mt-0.5">{subtitle}</p>}
      </div>
    </motion.div>
  );
}