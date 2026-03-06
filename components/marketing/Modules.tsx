"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

const steps = [
  {
    number: "01",
    title: "Connect your POS",
    description:
      "Qaos plugs into Square, Toast, Lightspeed, and 30+ other systems. Setup takes minutes, not days.",
  },
  {
    number: "02",
    title: "AI maps your kitchen",
    description:
      "Within days, Qaos learns your menu, ingredients, usage patterns, supplier rhythms, and seasonal shifts.",
  },
  {
    number: "03",
    title: "Intelligence on autopilot",
    description:
      "Automated ordering suggestions, waste tracking, stock alerts, and demand predictions — running quietly in the background.",
  },
];

export function Modules() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section id="modules" ref={ref} className="py-24 md:py-32">
      <div className="container px-6 md:px-8">
        {/* Two-column header: headline left, sub-line right */}
        <motion.div
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-border pb-10 mb-20 md:mb-28"
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="section-headline">
            Up and running
            <br />
            before lunch.
          </h2>
          <p className="text-muted-foreground text-base max-w-xs leading-relaxed">
            Three steps. No IT team. No downtime.
          </p>
        </motion.div>

        {/* Vertical step timeline */}
        <div className="max-w-3xl">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              className="flex gap-10 md:gap-16"
              initial={{ opacity: 0, x: -30 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{
                duration: 0.7,
                delay: 0.15 + i * 0.15,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {/* Step number + vertical connector */}
              <div className="flex flex-col items-center pt-1 shrink-0">
                <span className="font-display text-4xl md:text-5xl font-extrabold text-foreground/10 leading-none">
                  {step.number}
                </span>
                {i < steps.length - 1 && (
                  <div className="w-px flex-1 bg-border mt-4" />
                )}
              </div>

              {/* Content */}
              <div className={i < steps.length - 1 ? "pb-16 md:pb-20" : ""}>
                <h3 className="font-display text-xl md:text-2xl font-bold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.6 }}
        >
          <Link
            href="/integrations"
            className="inline-flex items-center gap-2 text-primary text-sm font-semibold hover:gap-3 transition-all"
          >
            See all integrations <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
