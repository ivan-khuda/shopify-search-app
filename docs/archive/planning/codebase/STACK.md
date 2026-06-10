# Technology Stack

**Analysis Date:** 2026-05-22

## Languages

**Primary:**
- TypeScript 5 - All application code, API routes, components, services
- JavaScript (with JSX/TSX) - React component definitions

**Secondary:**
- SQL - Prisma migrations and raw SQL for pgvector operations (e.g., `prisma/migrations/`)

## Runtime

**Environment:**
- Node.js (runtime inferred from Next.js 16 App Router; specific version not pinned in `.nvmrc`)

**Package Manager:**
- bun - Primary package manager
- Lockfile: `bun.lock` (present; 248KB)

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack framework with App Router for routing, SSR, API routes
- React 19.2.3 - UI component library
- React DOM 19.2.3 - DOM rendering

**Testing:**
- Vitest 4.1.5 - Test runner (config: `vitest.config.ts`, environment: jsdom)
- @testing-library/react 16.3.2 - React component testing utilities
- @testing-library/jest-dom 6.9.1 - DOM matchers
- @testing-library/user-event 14.6.1 - User interaction simulation
- @vitejs/plugin-react 6.0.1 - Vite React plugin for Vitest

**Build/Dev:**
- Tailwind CSS 4 - Utility-first CSS framework
- @tailwindcss/postcss 4 - PostCSS plugin for Tailwind
- PostCSS - CSS processing (config: `postcss.config.mjs`)
- TypeScript compiler - Type checking and transpilation
- ESLint 9 - Linting with Next.js config

## Key Dependencies

**Critical:**
- @prisma/client 7.3.0 - Prisma ORM client for database queries
- @prisma/adapter-pg 7.3.0 - PostgreSQL adapter for Prisma
- prisma 7.3.0 - Prisma CLI for migrations and schema management

**AI & LLM:**
- ai 6.0.77 - Vercel AI SDK for streaming AI responses
- @ai-sdk/google 3.0.21 - Google Gemini model integration via AI SDK
- @ai-sdk/react 3.0.75 - React hooks for AI (useChat, useCompletion)

**Shopify Integration:**
- @shopify/shopify-api 12.3.0 - Shopify Admin API client library
- @shopify/shopify-app-session-storage-prisma 8.0.1 - Prisma session storage for Shopify sessions
- @shopify/app-bridge-types 0.7.0 - TypeScript types for Shopify App Bridge
- @shopify/polaris-types 1.0.7 - TypeScript types for Shopify Polaris design system

**UI & Component Utilities:**
- radix-ui 1.4.3 - Headless UI component primitives
- class-variance-authority 0.7.1 - Type-safe CSS class composition
- tailwind-merge 3.4.0 - Merge Tailwind CSS classes without conflicts
- lucide-react 0.563.0 - Icon library (React components)
- motion 12.38.0 - Animation library
- cmdk 1.1.1 - Command palette / menu component
- clsx 2.1.1 - Utility for constructing className strings

**Utilities:**
- zod 4.3.6 - TypeScript-first schema validation
- dotenv 17.2.4 - Environment variable loader
- streamdown 2.1.0 - Streaming utilities
- nanoid 5.1.6 - URL-friendly unique ID generator
- dedent 1.7.1 - Remove leading whitespace from strings
- tsx 4.21.0 - TypeScript execution (used for Prisma seed script)

**Dev Dependencies:**
- @types/node 20 - Node.js type definitions
- @types/react 19 - React type definitions
- @types/react-dom 19 - React DOM type definitions
- @types/pg 8.16.0 - PostgreSQL client type definitions
- jsdom 29.0.2 - DOM implementation for testing
- typescript 5 - TypeScript compiler

## Configuration

**Environment:**
- Variables configured via `.env` file (see INTEGRATIONS.md for required variables)
- dotenv package loads environment on startup
- Prisma Accelerate supported via `DATABASE_URL` containing accelerate connection string

**Build:**
- `next.config.ts` - Next.js configuration with Webpack/Turbopack aliases for Prisma
- `tsconfig.json` - TypeScript configuration (target: ES2017, strict mode enabled, path alias: @/*)
- `vitest.config.ts` - Vitest configuration with jsdom environment
- `eslint.config.mjs` - ESLint configuration extending Next.js core-web-vitals and TypeScript rules
- `postcss.config.mjs` - PostCSS configuration with Tailwind CSS plugin
- `prisma.config.ts` - Prisma configuration pointing to `prisma/schema.prisma` and `prisma/migrations`

## Platform Requirements

**Development:**
- bun (package manager)
- Node.js runtime
- PostgreSQL database (via Prisma Accelerate or direct connection)
- Shopify Partner account with app credentials
- Google Cloud project with Generative AI API enabled (optional - chat endpoint falls back gracefully)

**Production:**
- Deployment target: Vercel (inferred from Next.js + Vercel AI SDK), but deployable to any Node.js host
- PostgreSQL database (managed or self-hosted)
- Environment variables for Shopify API keys, Google API key, database connection

---

*Stack analysis: 2026-05-22*
