"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const features = [
  {
    keyword: "Predict",
    title: "See demand before it arrives.",
    desc: "Qaos analyses sales history, local events, weather, and seasonality to forecast what your kitchen needs — before your team even thinks about it.",
    capability: "AI demand forecasting",
  },
  {
    keyword: "Watch",
    title: "Every ingredient, always accounted for.",
    desc: "Real-time stock levels that update as you sell, prep, and receive. Know what's running low, what's sitting idle, and what expires tomorrow.",
    capability: "Live inventory tracking",
  },
  {
    keyword: "Act",
    title: "From insight to action, instantly.",
    desc: "Expiring stock, sudden demand spikes, late deliveries — Qaos catches it first and tells you exactly what to do about it. No more firefighting.",
    capability: "Smart alerts & actions",
  },
  {
    keyword: "Learn",
    title: "Gets sharper the longer you use it.",
    desc: "Every order, every shift, every season makes the AI smarter. Qaos builds a living model of your kitchen that improves week after week.",
    capability: "Adaptive intelligence",
  },
];

export function Features() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="features" ref={ref} className="py-24 md:py-32">
      <div className="container px-6 md:px-8">
        <motion.div
          className="max-w-2xl mb-16 md:mb-24"
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="section-headline mb-6">
            Built to think
            <br />
            <span className="glow-text">like a head chef.</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-lg">
            Not another dashboard. An intelligence layer that understands the
            rhythm of a working kitchen.
          </p>
        </motion.div>

        {/* Editorial feature list */}
        <div className="border-t border-border">
          {features.map((feat, i) => (
            <motion.div
              key={feat.keyword}
              className="group border-b border-border py-10 md:py-14"
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.6,
                delay: 0.1 + i * 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start">
                <div className="md:col-span-3">
                  <span className="font-display text-3xl md:text-5xl font-extrabold tracking-tighter text-foreground/10 group-hover:text-primary/30 transition-colors duration-500">
                    {feat.keyword}
                  </span>
                </div>

                <div className="md:col-span-6">
                  <h3 className="font-display text-xl md:text-2xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors duration-500">
                    {feat.title}
                  </h3>
                  <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-lg">
                    {feat.desc}
                  </p>
                </div>

                <div className="md:col-span-3 md:text-right">
                  <span className="inline-block text-xs tracking-[0.15em] uppercase text-muted-foreground/40 border border-border rounded-full px-4 py-1.5">
                    {feat.capability}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
