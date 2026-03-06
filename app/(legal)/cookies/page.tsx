import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Cookie Policy | Qaos",
  description: "Cookie Policy for Qaos inventory management software.",
};

export default function CookiePolicyPage() {
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
            Cookie Policy
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
                1. What Are Cookies?
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Cookies are small text files that are stored on your device
                (computer, tablet, or mobile) when you visit a website. They are
                widely used to make websites work more efficiently and to
                provide information to website owners. Cookies help us provide
                you with a better experience by enabling us to monitor which
                pages you find useful and which you do not.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                2. How We Use Cookies
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Qaos uses cookies for the following purposes:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  <strong>Authentication:</strong> To keep you signed in and
                  secure your session
                </li>
                <li>
                  <strong>Preferences:</strong> To remember your settings and
                  preferences (e.g., theme, language)
                </li>
                <li>
                  <strong>Security:</strong> To protect against fraudulent
                  activity and ensure data integrity
                </li>
                <li>
                  <strong>Analytics:</strong> To understand how you use our
                  Service and improve it
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                3. Types of Cookies We Use
              </h2>

              <div className="mt-6 space-y-6">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Essential Cookies
                  </h3>
                  <p className="text-muted-foreground text-sm mb-2">
                    These cookies are necessary for the Service to function and
                    cannot be switched off. They are usually set in response to
                    actions you take, such as logging in or filling in forms.
                  </p>
                  <div className="mt-3 border-t border-border/40 pt-3">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="font-medium text-foreground">
                          Cookie Name
                        </p>
                        <p className="text-muted-foreground">sb-*-auth-token</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Purpose</p>
                        <p className="text-muted-foreground">Authentication</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Duration</p>
                        <p className="text-muted-foreground">
                          Session / 7 days
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg">
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Preference Cookies
                  </h3>
                  <p className="text-muted-foreground text-sm mb-2">
                    These cookies enable the Service to provide enhanced
                    functionality and personalisation, such as remembering your
                    preferred theme (light or dark mode).
                  </p>
                  <div className="mt-3 border-t border-border/40 pt-3">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="font-medium text-foreground">
                          Cookie Name
                        </p>
                        <p className="text-muted-foreground">theme</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Purpose</p>
                        <p className="text-muted-foreground">
                          Theme preference
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Duration</p>
                        <p className="text-muted-foreground">1 year</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg">
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Analytics Cookies
                  </h3>
                  <p className="text-muted-foreground text-sm mb-2">
                    These cookies help us understand how visitors interact with
                    our Service by collecting and reporting information
                    anonymously. This helps us improve the Service.
                  </p>
                  <div className="mt-3 border-t border-border/40 pt-3">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="font-medium text-foreground">
                          Cookie Name
                        </p>
                        <p className="text-muted-foreground">_ga, _gid</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Purpose</p>
                        <p className="text-muted-foreground">Usage analytics</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Duration</p>
                        <p className="text-muted-foreground">
                          2 years / 24 hours
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                4. Third-Party Cookies
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Some cookies are placed by third-party services that appear on
                our pages. We use the following third-party services that may
                set cookies:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  <strong>Stripe:</strong> For secure payment processing
                </li>
                <li>
                  <strong>Supabase:</strong> For authentication and database
                  services
                </li>
                <li>
                  <strong>Vercel:</strong> For hosting and analytics
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                5. Managing Cookies
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You can control and manage cookies in various ways. Please note
                that removing or blocking cookies may impact your user
                experience and some functionality may no longer be available.
              </p>

              <h3 className="text-xl font-medium text-foreground mb-3 mt-6">
                Browser Settings
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Most browsers allow you to refuse or accept cookies through
                their settings. Here&apos;s how to access cookie settings in
                popular browsers:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>
                  <a
                    href="https://support.google.com/chrome/answer/95647"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google Chrome
                  </a>
                </li>
                <li>
                  <a
                    href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Mozilla Firefox
                  </a>
                </li>
                <li>
                  <a
                    href="https://support.apple.com/en-gb/guide/safari/sfri11471/mac"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Safari
                  </a>
                </li>
                <li>
                  <a
                    href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Microsoft Edge
                  </a>
                </li>
              </ul>

              <h3 className="text-xl font-medium text-foreground mb-3 mt-6">
                Opt-Out Tools
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                For analytics cookies, you can opt out using:{" "}
                <a
                  href="https://tools.google.com/dlpage/gaoptout"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google Analytics Opt-out Browser Add-on
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                6. Changes to This Policy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Cookie Policy from time to time to reflect
                changes in our practices or for other operational, legal, or
                regulatory reasons. We will notify you of any material changes
                by updating the &quot;Last updated&quot; date at the top of this
                policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                7. Contact Us
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about our use of cookies, please
                contact us at:{" "}
                <a
                  href="mailto:privacy@qaos.co.uk"
                  className="text-primary hover:underline"
                >
                  privacy@qaos.co.uk
                </a>
              </p>
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
              <Link
                href="/privacy"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy Policy
              </Link>
              <Link href="/cookies" className="text-primary font-medium">
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
