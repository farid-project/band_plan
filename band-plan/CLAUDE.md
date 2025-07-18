# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a band management application built with React, TypeScript, and Supabase. It allows bands to manage members, create setlists, schedule events, and track member availability.

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build production bundle
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Architecture

### Frontend Stack
- **React 18** with TypeScript
- **Vite** as build tool
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Zustand** for state management
- **React Hot Toast** for notifications

### Backend & Database
- **Supabase** for authentication, database, and real-time features
- **PostgreSQL** database with Row Level Security (RLS)
- **Supabase Auth** with PKCE flow for authentication

### Key Architectural Patterns

#### State Management
- **Zustand store** (`src/store/authStore.ts`) manages authentication state
- Authentication state is synchronized with Supabase auth state changes
- Session persistence is handled automatically by Supabase

#### Database Schema
Key entities:
- `users` - User accounts
- `groups` - Bands/musical groups
- `group_members` - Members within groups (can be linked or unlinked users)
- `songs` - Song catalog per group (includes both regular songs and medleys via `type` field)
- `setlists` - Performance setlists
- `events` - Scheduled performances/rehearsals

#### Medley System
Medleys are implemented as songs with `type: 'medley'` in the songs table:
- `type` field distinguishes between 'song' and 'medley'
- `medley_song_ids` array field stores IDs of songs within the medley
- Medleys and regular songs coexist in the same table and can both be added to setlists

#### Authentication Flow
- PKCE flow for secure authentication
- Auto-detection of password recovery tokens in URL
- Automatic redirection to reset password pages
- Session management with auto-refresh

### Component Structure

#### Layout Components
- `Layout.tsx` - Main layout wrapper
- `Navbar.tsx` - Navigation bar with authentication state
- `Footer.tsx` - Application footer

#### Feature Components
- `GroupManagement.tsx` - Main group management interface
- `SetlistManagement.tsx` - Setlist creation and editing
- `EventsList.tsx` - Event scheduling and management
- `MemberAvailability.tsx` - Member availability tracking
- `PrintableSetlist.tsx` - Print-optimized setlist view

#### Modal Components
- `CreateGroupModal.tsx` - Group creation
- `AddMemberModal.tsx` - Member addition
- `CreateMedleyModal.tsx` - Medley creation
- `EventModal.tsx` - Event creation/editing

### Database Integration

#### Supabase Client
- Configured in `src/lib/supabase.ts`
- Uses environment-specific redirect URLs
- PKCE flow enabled for security

#### Utility Functions
- `src/lib/supabaseUtils.ts` - Database operation helpers
- `src/lib/setlistUtils.ts` - Setlist-specific utilities
- `src/utils/calendarSync.ts` - Calendar synchronization features

### Styling System
- **Tailwind CSS** with custom configuration
- **Print styles** in `src/print.css` for printable setlists
- **Custom fonts** for branded setlist printing (Florida Project Phase One, Pricedown)

### Development Notes

#### Database Migrations
- Migrations are stored in `supabase/migrations/`
- Follow the established naming convention: `YYYYMMDDHHMMSS_description.sql`
- Always include RLS policies for new tables

#### Component Patterns
- Use TypeScript interfaces from `src/types/index.ts`
- Implement proper error handling with toast notifications
- Follow existing modal patterns for consistency

#### Supabase Integration
- All database operations should use the configured Supabase client
- Implement proper error handling for database operations
- Use RLS policies for data security

### Key Features

#### Group Management
- Create and manage musical groups
- Add members (linked to users or standalone)
- Assign roles/instruments to members
- Member availability tracking with calendar sync

#### Setlist Management
- Create and organize setlists
- Add individual songs or medleys
- Drag-and-drop reordering with @dnd-kit
- Print-optimized setlist views
- Duplicate setlists functionality

#### Event Scheduling
- Schedule events with date/time
- Assign setlists to events
- Select specific members for events
- Location and notes management

#### Calendar Integration
- Member availability tracking
- Calendar synchronization capabilities
- Event scheduling with availability checks