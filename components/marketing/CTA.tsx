"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function CTA() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="py-32 md:py-40 border-t border-border">
      <div className="container px-6 md:px-8">
        <motion.div
          className="text-center max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="section-headline sm:hero-headline mb-8">
            Stop guessing.
            <br />
            <span className="glow-text">Start knowing.</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-12 max-w-lg mx-auto">
            Qaos is launching soon. Be among the first kitchens to turn instinct
            into intelligence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login?signup=true"
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-10 py-4 rounded-full text-base font-semibold hover:brightness-110 transition-all"
            >
              Join the waitlist
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 border border-border text-foreground px-10 py-4 rounded-full text-base font-medium hover:bg-card transition-colors"
            >
              Get in touch
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
