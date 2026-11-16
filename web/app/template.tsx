"use client";

import { motion, useReducedMotion } from "motion/react";

// Each page opens like a lens aperture: a circle grows from the bottom centre,
// where the dock sits, until it uncovers the whole page.
export default function Template({ children }: { children: React.ReactNode }) {
  const calm = useReducedMotion();

  if (calm) return <>{children}</>;

  return (
    <motion.div
      initial={{ clipPath: "circle(0% at 50% 100%)" }}
      animate={{ clipPath: "circle(150% at 50% 100%)" }}
      transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
    >
      {children}
    </motion.div>
  );
}
