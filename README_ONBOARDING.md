
# Pilot Onboarding System - Access Guide

## 1. Admin Access (Sending Packages)
To send an onboarding package to a pilot:
1.  Open the **Personnel Registry** tab in the sidebar.
2.  Find the pilot (or add a new one).
3.  Click the **"Send Package"** button (paper plane icon) in the Actions column.
4.  Confirm the action.
5.  Status will change to **"Onboarding Sent"**.

## 2. Pilot Access (The Portal)
The portal is a public-facing page protected by a secure token.
- **URL Pattern**: `/onboarding/portal/:token`
- **Email**: In production, the pilot receives an email with this link.

### Testing Locally
Since local email sending might be disabled or configured for printing to console, you can retrieve the valid link for testing using the helper script:

```bash
node scripts/get_onboarding_link.js
```

This will verify the last created package and print the clickable URL (e.g., `http://localhost:3000/onboarding/portal/abc-123...`).

## 3. Configuration
Ensure you have the PDF templates in your upload directory and the Gmail credentials in your `.env` file for emails to work correctly.
