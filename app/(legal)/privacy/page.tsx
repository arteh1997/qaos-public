import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Privacy Policy | Qaos",
  description: "Privacy Policy for Qaos inventory management software.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur-xl">
        <div className="container mx-auto px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/20">
                <span className="text-xl font-bold text-primary-foreground">
                  Q
                </span>
              </div>
              <span className="text-xl font-bold text-foreground">Qaos</span>
            </Link>
            <Button variant="ghost" asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-6 lg:px-8 py-12 lg:py-20">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground mb-8">
            Last updated:{" "}
            {new Date().toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>

          <div className="prose prose-neutral prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                1. Introduction
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Qaos (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is
                committed to protecting your privacy. This Privacy Policy
                explains how we collect, use, disclose, and safeguard your
                information when you use our inventory management service.
                Please read this policy carefully. By using our Service, you
                consent to the practices described in this Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                2. Information We Collect
              </h2>

              <h3 className="text-xl font-medium text-foreground mb-3 mt-6">
                2.1 Information You Provide
              </h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  <strong>Account Information:</strong> Name, email address,
                  password, and contact details
                </li>
                <li>
                  <strong>Business Information:</strong> Business name, address,
                  and operational details
                </li>
                <li>
                  <strong>Payment Information:</strong> Billing address and
                  payment card details (processed securely via Stripe)
                </li>
                <li>
                  <strong>Inventory Data:</strong> Stock levels, product
                  information, supplier details
                </li>
                <li>
                  <strong>Staff Information:</strong> Employee names, roles,
                  schedules, and clock-in/out times
                </li>
              </ul>

              <h3 className="text-xl font-medium text-foreground mb-3 mt-6">
                2.2 Information Collected Automatically
              </h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  <strong>Usage Data:</strong> How you interact with our
                  Service, features used, and actions taken
                </li>
                <li>
                  <strong>Device Information:</strong> Browser type, operating
                  system, device identifiers
                </li>
                <li>
                  <strong>Log Data:</strong> IP address, access times, pages
                  viewed, and referring URLs
                </li>
                <li>
                  <strong>Cookies:</strong> Session and preference data (see our
                  Cookie Policy for details)
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                3. How We Use Your Information
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Provide, maintain, and improve the Service</li>
                <li>Process transactions and send related information</li>
                <li>
                  Send you technical notices, updates, and support messages
                </li>
                <li>
                  Respond to your comments, questions, and customer service
                  requests
                </li>
                <li>Monitor and analyse usage patterns and trends</li>
                <li>
                  Detect, prevent, and address technical issues and security
                  threats
                </li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                4. Data Sharing and Disclosure
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We do not sell your personal information. We may share your
                information in the following circumstances:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  <strong>Service Providers:</strong> Third parties who perform
                  services on our behalf (hosting, payment processing,
                  analytics)
                </li>
                <li>
                  <strong>Legal Requirements:</strong> When required by law,
                  court order, or governmental authority
                </li>
                <li>
                  <strong>Business Transfers:</strong> In connection with a
                  merger, acquisition, or sale of assets
                </li>
                <li>
                  <strong>With Your Consent:</strong> When you have given us
                  explicit permission
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                5. Data Security
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement appropriate technical and organisational measures
                to protect your personal information, including encryption in
                transit (TLS/SSL), encryption at rest, regular security
                assessments, access controls, and secure data centres. However,
                no method of transmission over the internet is 100% secure, and
                we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                6. Data Retention
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your information for as long as your account is active
                or as needed to provide you with the Service. After account
                deletion, we retain certain data for up to 30 days to allow for
                data recovery. We may retain certain information as required by
                law or for legitimate business purposes, such as resolving
                disputes or enforcing our agreements.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                7. Your Rights (GDPR)
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Under the General Data Protection Regulation (GDPR), you have
                the following rights:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  <strong>Right of Access:</strong> Request a copy of the
                  personal data we hold about you
                </li>
                <li>
                  <strong>Right to Rectification:</strong> Request correction of
                  inaccurate personal data
                </li>
                <li>
                  <strong>Right to Erasure:</strong> Request deletion of your
                  personal data
                </li>
                <li>
                  <strong>Right to Restrict Processing:</strong> Request
                  limitation of processing of your data
                </li>
                <li>
                  <strong>Right to Data Portability:</strong> Receive your data
                  in a structured, machine-readable format
                </li>
                <li>
                  <strong>Right to Object:</strong> Object to processing of your
                  personal data
                </li>
                <li>
                  <strong>Right to Withdraw Consent:</strong> Withdraw consent
                  at any time where processing is based on consent
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                To exercise these rights, please contact us at{" "}
                <a
                  href="mailto:privacy@qaos.co.uk"
                  className="text-primary hover:underline"
                >
                  privacy@qaos.co.uk
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                8. International Data Transfers
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Your information may be transferred to and processed in
                countries other than your country of residence. These countries
                may have different data protection laws. When we transfer data
                internationally, we ensure appropriate safeguards are in place,
                including Standard Contractual Clauses approved by the European
                Commission.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                9. Children&apos;s Privacy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                The Service is not intended for individuals under the age of 18.
                We do not knowingly collect personal information from children.
                If you believe we have collected information from a child,
                please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                10. Changes to This Policy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. We will
                notify you of any material changes by posting the new policy on
                this page and updating the &quot;Last updated&quot; date. We
                encourage you to review this policy periodically.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                11. Contact Us
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy or our data
                practices, please contact us at:
              </p>
              <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                <p className="text-foreground font-medium">
                  Qaos Data Protection
                </p>
                <p className="text-muted-foreground">
                  Email:{" "}
                  <a
                    href="mailto:privacy@qaos.co.uk"
                    className="text-primary hover:underline"
                  >
                    privacy@qaos.co.uk
                  </a>
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-muted/10 py-8">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Qaos. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm">
              <Link
                href="/terms"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-primary font-medium">
                Privacy Policy
              </Link>
              <Link
                href="/cookies"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
