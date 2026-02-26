When you build the actual billing page in the future, you should also check currentStore?.is_billing_owner === true in the page component to prevent direct URL access.

1) Those are the credentials you'll get when you register your app with Xero's developer portal. Here's what each one is:

XERO_CLIENT_ID — Your app's public identifier, issued by Xero when you create an app at developer.xero.com
XERO_CLIENT_SECRET — The private key paired with the client ID (never exposed to the browser)
XERO_REDIRECT_URI — The URL Xero sends users back to after they authorise. For your app it would be something like https://yourdomain.com/api/integrations/xero/callback
You don't need these now. The code is built to gracefully handle them being absent — if a user tries to connect Xero and the vars aren't set, the OAuth redirect will just fail with an empty client ID. No crashes, no errors in normal operation.

When you do need them: Only when you're ready to actually let customers connect their Xero accounts. At that point you'd:

Create a free app at developer.xero.com
Copy the client ID and secret into your Vercel/hosting env vars
Set the redirect URI to match your production domain
Same pattern as your existing STRIPE_SECRET_KEY — the code references it, but it only matters when Stripe is actually being used.

