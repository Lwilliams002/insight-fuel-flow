# Insight Fuel Flow - Complete Insurance Claim Processing System

A comprehensive Vite + React + TypeScript web application for managing insurance claim processing, roofing sales, rep commissions, and geospatial lead tracking. Supports both Supabase and AWS deployments with a complete workflow from lead generation to project completion.

## ✨ Features

### 🔄 Complete Deal Workflow
- **Lead Generation**: Create deals from location pins or manual entry
- **Insurance Processing**: Track policy details, claims, ACV/RCV values, depreciation
- **Adjuster Management**: Schedule meetings and track adjuster interactions
- **Contract Management**: Digital signatures, agreement documents, permit tracking
- **Material Management**: Order tracking, delivery confirmation, install scheduling
- **Project Completion**: Installation tracking, final payments, commission calculations

### 👥 User Management
- **Admin Dashboard**: Full system oversight and user management
- **Rep Management**: Commission tracking, performance analytics, lead assignment
- **Role-Based Access**: Secure authentication with granular permissions

### 🗺️ Geospatial Features
- **Interactive Maps**: Mapbox-powered lead visualization and territory management
- **Pin Management**: Location-based lead tracking with status updates
- **Commission Assignment**: Automatic rep assignment based on territories

### ☁️ Deployment Options
- **Supabase**: Quick setup with managed PostgreSQL, auth, and edge functions
- **AWS**: Enterprise-grade infrastructure with RDS, Lambda, Cognito, and S3

## Quick links
- Source: `src/`
- Supabase: `supabase/` (migrations, functions, `config.toml`)
- AWS Infrastructure: `infrastructure/` (CDK stacks, Lambda functions)
- Public assets: `public/`
- Vite config: `vite.config.ts`

## Tech stack
- Frontend: React 18 + TypeScript
- Bundler / dev server: Vite
- Styling: Tailwind CSS
- Component primitives: Radix UI, lucide-react, shadcn-style conventions
- State & data fetching: @tanstack/react-query
- Auth / database / serverless: Supabase or AWS (Cognito + RDS + Lambda)
- Maps: Mapbox GL
- PWA: vite-plugin-pwa
- Testing: Vitest + @testing-library/react
- Infrastructure: AWS CDK (for AWS deployment)

## Prerequisites
- Node 18+ (or newer supported by Vite)
- npm, pnpm, or yarn (repo also contains a `bun.lockb` — if you prefer Bun, you can use `bun install`)
- For AWS deployment: AWS CLI configured with appropriate permissions
- For Supabase deployment: Supabase CLI (optional)

## Environment variables

### For Supabase Deployment
Create a `.env` file with:
```zsh
VITE_SUPABASE_URL=https://xyzcompany.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=pk.eyJ...your_key...
VITE_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_token
```

### For AWS Deployment
Create a `.env` file with:
```zsh
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=your-user-pool-id
VITE_COGNITO_CLIENT_ID=your-client-id
VITE_API_BASE_URL=your-api-gateway-url
VITE_S3_BUCKET=your-s3-bucket-name
VITE_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_token
```

## Install & run (local development)

Install dependencies:
```zsh
npm install
# or pnpm install
# or yarn install
# or bun install
```

Start development server:
```zsh
npm run dev
```

The dev server runs on port 8080 and listens on all interfaces.

## Build & preview
Build the production bundle:
```zsh
npm run build
```

Preview the production build locally:
```zsh
npm run preview
```

## Tests
Run unit tests with Vitest:
```zsh
npm run test          # run once
npm run test:watch    # watch mode
```

## Deployment Options

### Option 1: Supabase Deployment (Quick Start)
This is a static frontend that communicates with Supabase. Deploy steps:

1. Build the app: `npm run build`
2. Host the `dist/` folder on any static host (Netlify, Vercel, Render, etc.)
3. Deploy Supabase migrations and functions: `supabase deploy`
4. Set environment variables in your host provider

### Option 2: AWS Deployment (Enterprise)
For full infrastructure control and scalability:

1. **Configure AWS CLI**:
   ```bash
   aws configure
   ```

2. **Deploy infrastructure**:
   ```bash
   ./deploy-aws.sh
   ./init-database.sh
   ./create-admin.sh
   ```

3. **Update frontend .env** with the deployment outputs

4. **Build and deploy frontend**:
   ```bash
   npm run build
   # Upload dist/ to S3 or your preferred hosting
   ```

See `AWS_DEPLOYMENT_README.md` for detailed AWS deployment instructions.

## Full Workflow Testing

Once deployed, test the complete insurance claim processing workflow:

1. **Login** as admin user
2. **Create Deal** from pin or manual entry
3. **Schedule Inspection** date and adjuster meeting
4. **Enter Insurance Details** (policy, claim, ACV/RCV)
5. **Mark as Signed** when contract is ready
6. **Order Materials** and track delivery
7. **Schedule Install** date (after materials delivered)
8. **Mark as Installed** when work is complete
9. **Mark as Complete** for final status and commission calculation

## Project Structure
- `src/` — application source code
  - `components/` — reusable UI components and layouts
  - `pages/` — route pages (Admin, Rep, Auth, etc.)
  - `integrations/` — Supabase and AWS client configurations
  - `hooks/`, `contexts/` — app hooks and context providers
  - `test/` — test setup and example tests
- `public/` — static assets and PWA icons
- `supabase/` — local Supabase project (migrations, functions, config)
- `infrastructure/` — AWS CDK infrastructure code
- `Training/` — business process documentation

## Contributing
- Follow TypeScript and React + Vite conventions
- Add tests for new functionality
- Create feature branches and open pull requests

## License
No `LICENSE` file was detected. Add a LICENSE file if you intend to open-source the project.
