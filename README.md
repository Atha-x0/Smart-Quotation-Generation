# Smart Quotation Generation & Document Management System

A modern, offline-first monorepo application designed to eliminate manual calculation errors, speed up quotation creation, and maintain a permanent, tamper-evident archive of every quotation and revision ever generated.

---

## 🚀 Key Features

*   **Offline-First Architecture**: Treating the client device as the primary write target. Sales reps can create quotes in the field with poor or no internet connectivity. Local data is synced to the server once connection is restored.
*   **Immutable Revision Archiving**: Every edit or update creates a new revision node. Past records are never overwritten or deleted, ensuring a complete and tamper-evident history.
*   **Automated Tax & HSN Calculator**: Built-in fuzzy-matching against HSN/SAC databases, automatic CGST/SGST vs IGST calculation, and compliance-ready rounding rules.
*   **Bulk Excel Upload**: Upload quotation lists via Excel files with background processing (BullMQ & Redis) and a strict validation/preview UI before import.
*   **Dynamic Document Engine**: Letterheads, dynamic content blocks (Scope of Work, Specs, T&Cs), signatures, and auto-generated PDFs.

---

## 🛠️ Tech Stack & Workspace Structure

This project is built as an **npm workspaces monorepo**:

```text
├── apps/
│   ├── backend/        # NestJS REST API, Prisma ORM, PostgreSQL, Puppeteer (PDF generator)
│   └── frontend/       # Next.js, Tailwind CSS, IndexedDB (Dexie.js), PWA Service Workers
├── package.json        # Monorepo Workspace Configuration
└── .gitignore          # Repository exclusions configuration
```

### Backend (`apps/backend`)
*   **Framework**: [NestJS](https://nestjs.com/) (Node.js framework)
*   **Database & ORM**: PostgreSQL & [Prisma](https://www.prisma.io/)
*   **PDF Generation**: Puppeteer (HTML-to-PDF template rendering)
*   **Queueing**: BullMQ & Redis for async background jobs (Excel parsing, PDF compiles)
*   **Lint & Format**: ESLint & Prettier

### Frontend (`apps/frontend`)
*   **Framework**: [Next.js](https://nextjs.org/) (React framework)
*   **Styling**: Tailwind CSS
*   **Offline Database**: [Dexie.js](https://dexie.org/) (IndexedDB wrapper)
*   **Offline Search**: [Fuse.js](https://www.fusejs.io/) (Fuzzy client-side HSN matching)
*   **Rich Text Editor**: TipTap / Quill

---

## 🔧 Getting Started

### Prerequisites
*   Node.js (v18 or higher)
*   npm (v9 or higher)
*   PostgreSQL & Redis instance

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/Atha-x0/Smart-Quotation-Generation.git
    cd Smart-Quotation-Generation
    ```

2.  **Install dependencies** for all workspaces:
    ```bash
    npm install
    ```

3.  **Environment Setup**:
    - Configure `.env` files in `apps/backend/` and `apps/frontend/` using the provided `.env.example` templates.

4.  **Run migrations** (Backend):
    ```bash
    npm run prisma:migrate:dev --workspace=apps/backend
    ```

5.  **Run the Development Server**:
    - To start the backend:
      ```bash
      npm run dev:backend
      ```
    - To start the frontend:
      ```bash
      npm run dev:frontend
      ```
