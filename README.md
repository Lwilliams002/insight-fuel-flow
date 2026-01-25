# RoofCommission Pro (insight-fuel-flow)

A Vite + React + TypeScript web application for tracking roofing sales, reps, commissions, and geospatial leads using Supabase and Mapbox. The project includes a PWA setup, serverless functions (Supabase Edge Functions), and database migrations under the `supabase/` folder.

> Note: the repository package name is `vite_react_shadcn_ts` but the app manifest (PWA) uses the name "RoofCommission Pro" — this README uses the latter where appropriate.

## Quick links
- Source: `src/`
- Supabase: `supabase/` (migrations, functions, `config.toml`)
- Public assets: `public/`
- Vite config: `vite.config.ts`
- Supabase client: `src/integrations/supabase/client.ts`

## Tech stack
- Frontend: React 18 + TypeScript
- Bundler / dev server: Vite
- Styling: Tailwind CSS
- Component primitives: Radix UI, lucide-react, shadcn-style conventions
- State & data fetching: @tanstack/react-query
- Auth / database / serverless: Supabase (client: `@supabase/supabase-js`)
- Maps: Mapbox GL
- PWA: vite-plugin-pwa
- Testing: Vitest + @testing-library/react

## Prerequisites
- Node 18+ (or newer supported by Vite)
- npm, pnpm, or yarn (repo also contains a `bun.lockb` — if you prefer Bun, you can use `bun install`)
- (Optional) Supabase CLI if you want to run the local Supabase stack or deploy functions

## Environment variables
Create a `.env` or use your environment manager. The app reads the following variables (observed in `src/integrations/supabase/client.ts` and pages):

- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — anon/publishable key for the Supabase project
- `VITE_MAPBOX_ACCESS_TOKEN` — Mapbox public token (optional; app falls back to a server endpoint if not present)

Example `.env` (do not commit secrets):

```zsh
VITE_SUPABASE_URL=https://xyzcompany.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=pk.eyJ...your_key...
VITE_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_token
```

Notes:
- The code expects the Vite-prefixed names (import.meta.env.VITE_*) so they must start with `VITE_`.
- There may be additional secrets required by Supabase Edge Functions or server-side code; check `supabase/functions/` if you use them.

## Install & run (local development)
Install dependencies (npm example):

```zsh
# npm
npm install

# or pnpm
pnpm install

# or yarn
yarn install

# or bun
bun install
```

Start development server (Vite):

```zsh
npm run dev
# or pnpm run dev
# or yarn dev
```

The dev server is configured to run on port 8080 and listen on all interfaces (see `vite.config.ts`).

## Build & preview
Build the production bundle:

```zsh
npm run build
```

Preview the production build locally:

```zsh
npm run preview
```

There is also a `build:dev` script that runs a development-mode build:

```zsh
npm run build:dev
```

## Tests
Run unit tests with Vitest:

```zsh
npm run test
# watch mode
npm run test:watch
```

Vitest is configured in `vitest.config.ts` and uses `jsdom` environment with setup file `src/test/setup.ts`.

## Supabase notes
- Supabase config (project id) found at `supabase/config.toml`.
- Database migrations are under `supabase/migrations/` — use the Supabase CLI to apply locally or deploy.
- Edge Functions are in `supabase/functions/` (examples: `mapbox-token`) — these can be called from the client if authenticated.

Common Supabase CLI commands (install first: https://supabase.com/docs/guides/cli):

```zsh
# start local supabase (if using local DB/emulator)
supabase start

# push database changes
supabase db push

# deploy functions and database
supabase deploy
```

If your app relies on Supabase-authenticated requests to serverless functions, ensure the client obtains a session before calling them (the code already tries to fetch a Mapbox token from a function when the env token is missing).

## Folder overview
- `src/` — application source code
  - `components/` — reusable UI components and layouts
  - `pages/` — route pages (Admin, Rep, Auth, etc.)
  - `integrations/supabase/` — Supabase client and types
  - `hooks/`, `contexts/` — app hooks and context providers
  - `test/` — test setup and example tests
- `public/` — static assets and PWA icons
- `supabase/` — local Supabase project (migrations, functions, config)
- `vite.config.ts`, `tsconfig.json`, `package.json` — project config

## Deployment
This is a static frontend that communicates with Supabase. Typical deployment steps:

1. Build the app:

```zsh
npm run build
```

2. Host the `dist/` folder on any static host (Netlify, Vercel, Render, S3 + CloudFront, etc.) or use Vercel's/Vite's recommended flow.
3. Deploy Supabase migrations and functions using the Supabase CLI.
4. Set the environment variables in your host provider (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_MAPBOX_ACCESS_TOKEN if needed).

Notes on Vercel/Netlify:
- Ensure the build environment sets the VITE_* variables. These are injected at build time.
- If using server-side tokens (Mapbox secret), prefer using serverless functions to avoid exposing private keys.

## Troubleshooting
- Missing env vars: The app will fail to connect to Supabase or load maps if `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are missing.
- Mapbox: If maps are blank, verify `VITE_MAPBOX_ACCESS_TOKEN` or that the `mapbox-token` Supabase function is returning a valid token.
- CORS / 401 from Supabase functions: ensure the request is authenticated (the client tries to pass current session tokens when calling functions).
- Local Supabase issues: run `supabase start` and check the CLI output for DB listen errors.

## Contributing
- Follow the repo conventions (TypeScript, React + Vite).
- Add tests for new functionality and run `npm run test`.
- Create feature branches and open pull requests for review.

## License
No `LICENSE` file was detected in the repository. Add a LICENSE file (for example MIT) if you intend to make the project open-source.

## Assumptions & missing information
- The app manifest labels the product as "RoofCommission Pro"; `package.json` uses `vite_react_shadcn_ts`. I assumed "RoofCommission Pro" is the user-facing name.
- Exact CI/CD or hosting provider is unknown — deployment instructions above are generic.
- There is no `.env.example` in the repo. I recommend adding one with the VITE_* names (without real keys).

---

## AWS Migration Guide

The project includes infrastructure for migrating from Supabase to AWS. This provides more control over infrastructure, better scalability, and enterprise-grade security.

### AWS Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Amazon CloudFront                          │
│                    (CDN for React Frontend)                         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────────┐
        ▼                           ▼                               ▼
┌───────────────┐          ┌───────────────┐              ┌───────────────┐
│   S3 Bucket   │          │  API Gateway  │              │   Cognito     │
│  (Frontend)   │          │   (REST API)  │              │  User Pool    │
└───────────────┘          └───────┬───────┘              │  (Auth)       │
                                   │                      └───────────────┘
                                   ▼
                           ┌───────────────┐
                           │    Lambda     │
                           │  Functions    │
                           └───────┬───────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│      RDS      │          │      S3       │          │   Secrets     │
│  PostgreSQL   │          │   (Storage)   │          │   Manager     │
└───────────────┘          └───────────────┘          └───────────────┘
```

### AWS Services Mapping

| Supabase Feature | AWS Replacement |
|-----------------|-----------------|
| Authentication | Amazon Cognito |
| PostgreSQL Database | Amazon RDS PostgreSQL |
| Edge Functions | AWS Lambda + API Gateway |
| Storage | Amazon S3 |
| Row Level Security | Lambda middleware + Cognito groups |

### Prerequisites for AWS Migration

1. **AWS CLI**: Install and configure
   ```bash
   brew install awscli
   aws configure
   ```

2. **AWS CDK**: Install globally
   ```bash
   npm install -g aws-cdk
   ```

3. **Bootstrap CDK** (first time only):
   ```bash
   cd infrastructure
   npm install
   cdk bootstrap
   ```

### Deploy to AWS

1. **Deploy all stacks**:
   ```bash
   cd infrastructure
   npm run deploy:dev    # For development
   npm run deploy:prod   # For production
   ```

2. **Note the outputs** - CDK will display:
   - `CognitoUserPoolId`
   - `CognitoUserPoolClientId`
   - `ApiUrl`
   - `StorageBucketName`

3. **Update frontend environment**:
   ```bash
   # Create .env file with AWS values
   VITE_AWS_REGION=us-east-1
   VITE_COGNITO_USER_POOL_ID=<from CDK output>
   VITE_COGNITO_USER_POOL_CLIENT_ID=<from CDK output>
   VITE_API_URL=<from CDK output>
   VITE_S3_BUCKET=<from CDK output>
   ```

### Data Migration

1. **Export Supabase data**:
   ```bash
   cd infrastructure/scripts
   chmod +x migrate-data.sh
   
   # Set environment variables
   export SUPABASE_HOST=db.your-project.supabase.co
   export SUPABASE_PASSWORD=your-password
   export RDS_HOST=your-rds-endpoint.rds.amazonaws.com
   export RDS_PASSWORD=your-rds-password
   
   ./migrate-data.sh
   ```

2. **Migrate users to Cognito**:
   ```bash
   chmod +x migrate-users.sh
   export USER_POOL_ID=us-east-1_xxxxxxxxx
   ./migrate-users.sh
   ```

   > ⚠️ Users will need to reset their passwords after migration.

### Switching the Frontend

To switch from Supabase to AWS authentication:

1. **Replace AuthProvider in `main.tsx`**:
   ```tsx
   // Change from:
   import { AuthProvider } from '@/contexts/AuthContext';
   
   // To:
   import { AwsAuthProvider } from '@/contexts/AwsAuthContext';
   ```

2. **Update component imports**:
   ```tsx
   // Change from:
   import { useAuth } from '@/contexts/AuthContext';
   
   // To:
   import { useAwsAuth } from '@/contexts/AwsAuthContext';
   ```

3. **Replace Supabase API calls with AWS API**:
   ```tsx
   // Change from:
   import { supabase } from '@/integrations/supabase/client';
   const { data } = await supabase.from('deals').select('*');
   
   // To:
   import { dealsApi } from '@/integrations/aws';
   const { data } = await dealsApi.list();
   ```

### AWS Infrastructure Files

```
infrastructure/
├── bin/
│   └── infrastructure.ts    # CDK app entry point
├── lib/
│   ├── auth-stack.ts        # Cognito User Pool
│   ├── database-stack.ts    # RDS PostgreSQL + VPC
│   ├── storage-stack.ts     # S3 bucket
│   └── api-stack.ts         # API Gateway + Lambda
├── lambda/
│   ├── shared/              # Shared utilities
│   ├── deals/               # Deals CRUD
│   ├── reps/                # Reps management
│   ├── pins/                # Location pins
│   ├── commissions/         # Commissions tracking
│   ├── upload/              # S3 presigned URLs
│   └── admin/               # Admin operations
├── scripts/
│   ├── migrate-data.sh      # Database migration
│   └── migrate-users.sh     # User migration
└── package.json
```

### Cost Considerations

AWS costs will vary based on usage. Estimated monthly costs for a small deployment:

| Service | Estimated Cost |
|---------|---------------|
| RDS (t3.micro) | ~$15-25/month |
| Lambda | ~$0-5/month (free tier) |
| API Gateway | ~$3-10/month |
| Cognito | ~$0-5/month |
| S3 | ~$1-5/month |
| **Total** | **~$20-50/month** |

For production, consider:
- RDS Multi-AZ for high availability
- CloudFront for CDN
- WAF for security
- Reserved instances for cost savings

---

If you'd like, I can:
- Add a `.env.example` file with placeholders for required variables.
- Add a short development checklist or scripts to automate starting supabase + frontend together.
- Add a `LICENSE` file (e.g., MIT) if you want to open-source the project.

