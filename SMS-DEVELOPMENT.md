# Mobile OTP voting — local development

The page reads the current active election and candidates from PostgreSQL.
The UI accepts Georgian mobile numbers and the server normalizes them to +9955XXXXXXXX.
The existing email columns are retained as nullable fields to preserve earlier test data;
new requests require a phone number and never accept email authentication.

## Start

Open Docker Desktop. In a terminal:

    docker start doctor-voting-db
    cd "C:\Users\t.tsirekidze\Desktop\my website\doctor-voting"
    npm run dev

Keep that terminal open and visit http://localhost:3000.
The demo election is active for 30 days from initial seeding.

## SMS status

Only the console adapter is implemented. With npm run dev and SMS_PROVIDER=console
(the development default), a line like [TEST SMS] {"phone":"...","otp":"..."}
appears in the server terminal. Nothing is sent to a mobile network and no SMS balance
is used. The browser explicitly labels this as a test mode. The send endpoint refuses
requests outside development or if a different, unconfigured provider is selected.

Real uBill integration is still pending: account/API key, approved sender, provider
error handling and delivery tracking, live network tests, and production abuse controls.
Do not deploy this as production-ready voting yet. In particular add IP/global rate
limits, CAPTCHA, sending budgets, admin authentication, and a full security review.
Do not paste API secrets into chat or put them in browser code.

## Behavior

- OTP is bound to the normalized phone, election and candidate.
- OTP expires after 10 minutes; 5 wrong guesses lock that challenge.
- Resends have a 60-second cooldown; only the latest challenge is accepted.
- A PostgreSQL transaction consumes the OTP and inserts the vote together.
- Per-phone transaction locks serialize concurrent submissions and guesses.
- A database unique constraint prevents two votes for a phone in one election.
- Inactive, future and ended elections reject voting; candidates must belong to the election.
- Public API responses exclude voter data and vote counts.
- One phone is not proof of one physical person; a person may own multiple numbers.

## Database and tests

In another terminal in the project directory:

    npx prisma db migrate
    node scripts/seed-demo.mjs
    node scripts/test-voting.mjs
    npx tsc --noEmit --incremental false

Seed only creates an election and three demo candidates if the election table is empty.
The integration suite needs the development server running, uses temporary elections,
never sends real SMS, and cleans up its own fixtures. Run it only in local development.
Production deployment/build and real SMS delivery have not been validated.
