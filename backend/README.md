# TaHanap Backend

Express + MongoDB API powering TaHanap.

## Quick Start

1. Copy `.env.example` to `.env` and fill values (see below).
2. Install deps:
   ```bash
   npm install
   ```
3. Run dev server:
   ```bash
   npm run server
   ```
4. (Optional) Create initial admin user:
   ```bash
   npm run create-admin
   ```

## Environment Variables

Required:
- `MONGO_URI` Mongo connection string
- `RESEND_API_KEY` Resend API key for transactional emails

Optional:
- `ADMIN_INITIAL_USERNAME` (default: `admin`)
- `ADMIN_INITIAL_EMAIL` (default: `admin@tahanap.com`)
- `ADMIN_INITIAL_PASSWORD` (default: `TAHANAPadmin` – change in prod!)
- `ADMIN_FORCE_RESET` set to `1` to rotate password of existing admin user

## Admin Bootstrap

The script `npm run create-admin` checks for a user with the target username (default `admin`).
- If absent: creates one with provided / default credentials.
- If present & `ADMIN_FORCE_RESET=1`: rotates password (and email if overridden env provided).
- If present & no force flag: exits without changes.

Security tips:
- ALWAYS override `ADMIN_INITIAL_PASSWORD` in production.
- Use `ADMIN_FORCE_RESET=1` to safely rotate the seeded password.
- Remove the script or revoke creds after first login.
- Enforce periodic rotation for the seeded admin.

## Mail & OTP

Authentication emails use branded dark-themed templates with 2‑minute OTP expiry. The project now requires Resend (https://resend.com) for transactional email delivery. Set `RESEND_API_KEY` in your environment before starting the server.

## Verification Logic

Landlord verification now requires at least one accepted ID document (status `accepted`). Legacy `approved` values are normalized to `accepted`.

## Scripts
- `npm run server` Start API
- `npm run create-admin` Seed admin user

## Admin Password Rotation

Authenticated admins can rotate their own password via:

POST /api/auth/admin/change-password
Body: { "oldPassword": "current", "newPassword": "NewStrongerPass123!" }
Requires: Authorization: Bearer <token>

On success, tokenVersion increments and existing tokens become invalid – admin must re-login.

### Emergency Password Reset (script)
If you cannot log in (lost password / tokens invalid), run the reset script:

PowerShell example:
```powershell
$env:ADMIN_RESET_USERNAME = "admin"
$env:ADMIN_NEW_PASSWORD = "NewStrongPass123!"
npm run reset-admin-password
```
Then log in with the new password. Previous tokens are invalidated.

## Tech Stack
- Express / Mongoose / Resend / JWT / Multer

## Future Enhancements
- Rate limiting
- Centralized logging (Winston / Pino)
- Swagger / OpenAPI docs

---
© 2025 TaHanap
