# Production launch checklist

Run `npm run check`, `npm audit --omit=dev --audit-level=high`, and `npm run check:production` before every production release.

## Required external configuration

- Set `LEGAL_OPERATOR_NAME` to the registered operating entity and `LEGAL_SUPPORT_EMAIL` to a monitored address.
- Set `RESEND_WEBHOOK_SECRET` to the `whsec_...` signing secret from the Resend webhook details page. Do not place secrets in the webhook URL.
- Verify the sending domain with SPF and DKIM, publish a DMARC policy, and test sign-up, verification, support inbound, and replies.
- Enable managed Postgres backups and point-in-time recovery. Complete and record a restore drill before launch, then repeat it quarterly.
- Configure an object-storage lifecycle rule for abandoned uploads and verify that account deletion removes linked review and assignment images.
- Set storage upload/download limits in the admin workspace and alerts below the provider's billing limits.
- Configure `OPS_ALERT_WEBHOOK_URL` to an internal HTTPS incident endpoint and monitor `/api/health` from outside the hosting provider.
- Confirm the production function duration supports the review pipeline's worst-case timeout and retries. Use a durable queue before raising traffic materially.
- Replace the legal-page defaults with the legal entity details and have counsel review privacy, terms, refund, minors, cross-border processing, trademark use, and required filings.

## Release smoke test

1. Register and verify a new account.
2. Submit Task 1 with an image and Task 2 without one.
3. Confirm successful reviews consume the correct entitlement and failures return it.
4. Reopen history, export a revision, create and revoke a share link.
5. Submit feedback, an order question, and a refund request; process them from the admin workspace.
6. Delete a test account and confirm reviews, shares, stored images, and account access are removed while transaction records are de-identified.
