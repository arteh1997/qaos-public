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
    <section
      id="modules"
      ref={ref}
      className="py-24 md:py-32 relative overflow-hidden"
    >
      {/* Background accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-highlight/5 rounded-full blur-[150px] -translate-x-1/2" />
      </div>

      <div className="container px-6 md:px-8 relative z-10">
        <motion.div
          className="max-w-2xl mb-20"
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="text-primary text-xs font-semibold uppercase tracking-widest mb-4 block">
            Getting started
          </span>
          <h2 className="section-headline mb-6">
            Up and running
            <br />
            before lunch.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              className={`relative p-10 md:p-12 ${i < steps.length - 1 ? "border-b md:border-b-0 md:border-r border-border" : ""}`}
              initial={{ opacity: 0, y: 50 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.7,
                delay: 0.1 + i * 0.15,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <span className="font-display text-6xl font-extrabold text-primary/15 mb-6 block">
                {step.number}
              </span>
              <h3 className="font-display text-xl font-bold text-foreground mb-3">
                {step.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-16 text-center"
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
