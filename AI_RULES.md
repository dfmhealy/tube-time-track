# AI Development Rules for YTTracker

This document outlines the rules and conventions for AI-driven development of this application. Adhering to these rules ensures consistency, maintainability, and leverages the existing tech stack effectively.

## Core Tech Stack

This project is built with a modern, type-safe, and efficient technology stack:

-   **Framework**: React (with TypeScript) built on top of Vite for a fast development experience.
-   **Backend & Database**: Supabase is used for all backend services, including authentication, a PostgreSQL database with Row Level Security (RLS), and storage.
-   **UI Components**: shadcn/ui provides a set of pre-built, accessible, and themeable components built on Radix UI.
-   **Styling**: Tailwind CSS is used exclusively for styling via utility classes.
-   **State Management**: Zustand is used for global client-side state management.
-   **Routing**: React Router handles all client-side navigation and routing.
-   **Data Fetching**: TanStack Query is used for managing server state, including caching, refetching, and mutations.
-   **Forms**: React Hook Form with Zod for schema validation provides a robust solution for handling forms.
-   **Icons**: Lucide React is the designated icon library.

## Library Usage and Coding Conventions

Follow these rules strictly to maintain code quality and consistency.

### 1. UI and Styling

-   **Component Library**: **ALWAYS** use components from `shadcn/ui` (`@/components/ui/...`) when available. Do not create custom buttons, inputs, cards, etc., if a shadcn/ui component exists.
-   **Styling**: **ONLY** use Tailwind CSS utility classes for styling. Do not write custom CSS files. Global styles are defined in `src/index.css` and should rarely be modified.
-   **Layout**: Use Flexbox and Grid utilities from Tailwind for all layouts. Ensure all components are responsive.
-   **Icons**: **ONLY** use icons from the `lucide-react` package.

### 2. State Management

-   **Global Client State**: Use **Zustand** for managing global UI state (e.g., current view, player state). Follow the existing patterns in `src/store/`.
-   **Local Component State**: Use React's built-in `useState` and `useReducer` hooks for state that is local to a single component.
-   **Server State / Data Fetching**: Use **TanStack Query** (`useQuery`, `useMutation`) for fetching and managing data from Supabase.

### 3. Backend and Data

-   **Database Interaction**: All communication with the Supabase database **MUST** go through the abstraction layers in `src/lib/database.ts` and `src/lib/podcastDatabase.ts`. Do not call `supabase.from(...)` directly within components.
-   **Authentication**: Use the `useAuth` hook from `src/contexts/AuthContext.tsx` for all authentication-related logic (sign-in, sign-out, accessing user data).
-   **Security**: All database queries must respect Supabase's Row Level Security (RLS). The service functions in `src/lib/database.ts` are designed to handle this automatically by filtering by `user_id`.

### 4. Forms

-   **Form Handling**: For any form that requires validation, **MUST** use `react-hook-form`.
-   **Validation**: Use **Zod** to define validation schemas for forms.

### 5. Routing

-   **Navigation**: Use `react-router-dom` for all routing.
-   **Route Definitions**: All routes are defined in `src/App.tsx`. Add new routes there.
-   **Protected Routes**: Wrap any route that requires authentication with the `<ProtectedRoute>` component.

### 6. Notifications

-   **User Feedback**: Use `sonner` to display toast notifications for user actions (e.g., success, error, info). Import and use the `toast()` function from `sonner`.