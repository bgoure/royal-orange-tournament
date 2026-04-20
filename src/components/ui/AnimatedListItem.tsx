"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export function AnimatedListItem({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const delay = reduced ? 0 : index * 0.05;

  return (
    <motion.li
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduced ? 0 : 0.25,
        delay,
        ease: "easeOut",
      }}
    >
      {children}
    </motion.li>
  );
}
