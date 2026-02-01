import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Terms of Service | RestaurantOS',
  description: 'Terms of Service for RestaurantOS restaurant inventory management software.',
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur-xl">
        <div className="container mx-auto px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/20">
                <span className="text-xl font-bold text-primary-foreground">R</span>
              </div>
              <span className="text-xl font-bold text-foreground">RestaurantOS</span>
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
            Terms of Service
          </h1>
          <p className="text-muted-foreground mb-8">
            Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">1. Agreement to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using RestaurantOS (&quot;the Service&quot;), you agree to be bound by these Terms of Service.
                If you do not agree to these terms, you may not access or use the Service. These terms apply to all
                visitors, users, and others who access or use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">2. Description of Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                RestaurantOS provides a cloud-based restaurant inventory management platform that enables users to
                track inventory, manage shifts, generate reports, and oversee multi-location operations. The Service
                is provided on a subscription basis.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">3. Account Registration</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                To use the Service, you must create an account. You agree to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain and promptly update your account information</li>
                <li>Keep your password secure and confidential</li>
                <li>Accept responsibility for all activities that occur under your account</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">4. Subscription and Payment</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The Service is offered on a subscription basis at £299 per store per month. By subscribing, you agree to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Pay the applicable subscription fees for your selected plan</li>
                <li>Provide valid payment information</li>
                <li>Authorize us to charge your payment method on a recurring basis</li>
                <li>Be responsible for all applicable taxes</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                We offer a 14-day free trial for new accounts. No payment is required during the trial period.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">5. Cancellation and Refunds</h2>
              <p className="text-muted-foreground leading-relaxed">
                You may cancel your subscription at any time. Upon cancellation, your access will continue until the
                end of your current billing period. We do not provide refunds for partial months or unused time.
                After cancellation, your data will be retained for 30 days before permanent deletion, during which
                time you may export your data.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">6. Acceptable Use</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You agree not to use the Service to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe upon the rights of others</li>
                <li>Upload malicious code, viruses, or harmful content</li>
                <li>Attempt to gain unauthorized access to the Service or its systems</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Use the Service for any illegal or unauthorized purpose</li>
                <li>Share your account credentials with unauthorized parties</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">7. Data Ownership</h2>
              <p className="text-muted-foreground leading-relaxed">
                You retain all rights to the data you upload to the Service. We do not claim ownership of your content.
                You grant us a limited license to use, store, and process your data solely for the purpose of providing
                the Service. We will not sell, share, or use your data for purposes other than providing the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">8. Service Availability</h2>
              <p className="text-muted-foreground leading-relaxed">
                We strive to maintain 99.9% uptime for the Service. However, we do not guarantee uninterrupted access
                and may occasionally need to perform maintenance or updates. We will endeavour to provide advance notice
                of planned maintenance. We are not liable for any damages resulting from service interruptions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">9. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                To the maximum extent permitted by law, RestaurantOS shall not be liable for any indirect, incidental,
                special, consequential, or punitive damages, including but not limited to loss of profits, data, or
                business opportunities. Our total liability shall not exceed the amount you paid for the Service in
                the twelve months preceding the claim.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">10. Indemnification</h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree to indemnify and hold harmless RestaurantOS, its officers, directors, employees, and agents
                from any claims, damages, losses, or expenses arising from your use of the Service or violation of
                these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">11. Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify you of significant changes via
                email or through the Service. Your continued use of the Service after changes become effective
                constitutes acceptance of the modified Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">12. Governing Law</h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of England and Wales.
                Any disputes arising from these Terms or your use of the Service shall be subject to the exclusive
                jurisdiction of the courts of England and Wales.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">13. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms of Service, please contact us at:{' '}
                <a href="mailto:legal@restaurantos.com" className="text-primary hover:underline">
                  legal@restaurantos.com
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
              &copy; {new Date().getFullYear()} RestaurantOS. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/terms" className="text-primary font-medium">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link href="/cookies" className="text-muted-foreground hover:text-foreground transition-colors">
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
