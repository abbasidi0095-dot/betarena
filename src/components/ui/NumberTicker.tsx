"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useSpring } from "framer-motion";
import { cn } from "@/lib/client/cn";

/**
 * NumberTicker (adapted from 21st.dev dillionverma/number-ticker):
 * counts from the previous value to the new value whenever `value` changes.
 * Drives the balance chip — Betclic-style animated points.
 */
export function NumberTicker({
  value,
  className,
  decimalPlaces = 0,
}: {
  value: number;
  className?: string;
  decimalPlaces?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  const motionValue = useMotionValue(value);
  const springValue = useSpring(motionValue, { damping: 45, stiffness: 110 });

  useEffect(() => {
    if (prev.current === value) return;
    motionValue.set(prev.current);
    prev.current = value;
    motionValue.set(value);
  }, [value, motionValue]);

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (ref.current) {
          ref.current.textContent = Intl.NumberFormat("en-GB", {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
          }).format(Number(latest.toFixed(decimalPlaces)));
        }
      }),
    [springValue, decimalPlaces],
  );

  return (
    <span
      ref={ref}
      className={cn("inline-block tabular-nums tracking-wider", className)}
    >
      {Intl.NumberFormat("en-GB", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(value)}
    </span>
  );
}
