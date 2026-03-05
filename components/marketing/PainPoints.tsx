"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const questions = [
  {
    question: "How much food did you throw away last week?",
    follow: "Most kitchens can't answer this. Qaos can — down to the gram.",
  },
  {
    question: "What will your busiest day look like this Friday?",
    follow: "AI reads the patterns your team feels but can't prove.",
  },
  {
    question: "Which supplier is actually costing you the most?",
    follow: "Not the one with the highest prices. The one with the most waste.",
  },
];

export function PainPoints() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-24 md:py-40 overflow-hidden">
      <div className="container px-6 md:px-8">
        <motion.p
          className="text-muted-foreground/40 text-xs tracking-[0.3em] uppercase mb-16 md:mb-24"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8 }}
        >
          The questions that keep chefs up at night
        </motion.p>

        <div className="space-y-16 md:space-y-24 max-w-4xl">
          {questions.map((q, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.8,
                delay: i * 0.15,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <h3 className="font-display text-2xl sm:text-3xl md:text-5xl font-bold tracking-tighter text-foreground leading-[1.1] mb-4 md:mb-6">
                {q.question}
              </h3>
              <p className="text-muted-foreground text-base md:text-lg max-w-lg leading-relaxed">
                {q.follow}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
