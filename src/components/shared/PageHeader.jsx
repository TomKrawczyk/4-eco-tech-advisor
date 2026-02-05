import React from "react";
import { motion } from "framer-motion";

export default function PageHeader({ title, subtitle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h1>
      {subtitle && <p className="text-gray-600 text-sm mt-1">{subtitle}</p>}
    </motion.div>
  );
}