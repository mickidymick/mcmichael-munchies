# McMichael Munchies

A family recipe sharing app built with React Native (Expo) and Supabase. Families can collect, browse, and share recipes with role-based access control. Deployed as a web app on Vercel.

## Tech Stack

| Technology | Purpose | Dashboard / Docs |
|---|---|---|
| [Expo](https://expo.dev) | React Native framework, builds, dev server | https://expo.dev/accounts |
| [Supabase](https://supabase.com) | Database, auth, file storage, RLS | https://supabase.com/dashboard |
| [Vercel](https://vercel.com) | Web hosting & deployment | https://vercel.com/dashboard |
| [USDA FoodData Central](https://fdc.nal.usda.gov) | Nutrition/calorie estimation API | https://fdc.nal.usda.gov/api-key-signup |
| [Resend](https://resend.com) | Email notifications for access requests | https://resend.com/overview |

## Project Structure

```
app/
  _layout.tsx            # Root layout, auth redirects, error boundary
  (tabs)/
    index.tsx            # Home - carousel, recent recipes, categories
    browse.tsx           # Search, filter, sort recipes (paginated)
    favorites.tsx        # Saved recipes (synced per-user)
    profile.tsx          # Auth, stats, access requests, admin actions
  recipe/[id].tsx        # Recipe detail view
  add-recipe.tsx         # Create a new recipe
  edit-recipe/[id].tsx   # Edit an existing recipe
  auto-import.tsx        # Batch import recipes via JSON
  review-queue.tsx       # Review imported recipes before publishing
  admin.tsx              # Manage member roles
  pending-requests.tsx   # Approve/deny access requests
  forgot-password.tsx    # Password recovery
  reset-password.tsx     # Set new password from email link

components/
  NavBar.tsx             # Web navigation header
  RecipeCard.tsx         # Recipe list item
  SearchBar.tsx          # Search with autocomplete dropdown
  ChipRow.tsx            # Filter chip selector
  LazyImage.tsx          # Image with lazy loading + error fallback
  FamilyBadge.tsx        # Colored family identifier badge
  DraggableRow.tsx       # Drag-to-reorder (desktop)
  ErrorBoundary.tsx      # Catches unhandled errors
  Tooltip.tsx            # Hover tooltip

lib/
  supabase.ts            # Supabase client + TypeScript types
  nutrition.ts           # USDA calorie estimation
  useFavorites.ts        # Favorites hook (optimistic updates)
  useUserRole.ts         # Auth role hook
  autocomplete.ts        # Tag/ingredient suggestion cache
  utils.ts               # Shared utilities

constants/
  colors.ts              # Design tokens, layout
  recipes.ts             # Categories, families, cuisines, units
```

## Database Tables

| Table | Purpose |
|---|---|
| `profiles` | User metadata, roles (viewer / member / admin) |
| `recipes` | All recipe data (ingredients, steps, nutrition, images) |
| `favorites` | Per-user saved recipes |
| `access_requests` | Member access request workflow |
| `review_queue` | Staging area for imported recipes |

All tables have Row-Level Security (RLS) enabled. See `supabase-setup.sql` for the full schema.

## Roles

- **Viewer** - Can browse and favorite recipes
- **Member** - Can add, edit, delete, and import recipes
- **Admin** - Can manage members, approve access requests

## Environment Variables

Create a `.env.local` file in the project root:

```
EXPO_PUBLIC_SUPABASE_URL=<your-supabase-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
EXPO_PUBLIC_USDA_API_KEY=<your-usda-api-key>
EXPO_PUBLIC_SITE_URL=<your-production-url>  # optional, used for password reset on native
```

## Getting Started

```bash
# Install dependencies
npm install

# Start the dev server (web)
npm run web

# Or use the helper script
./start_website.sh
```

## Deployment

Web builds are deployed to Vercel. The build command and config are in `vercel.json`:

```bash
npx expo export --platform web
```

Output goes to `dist/`, which Vercel serves as a static SPA.

## Families

The app organizes recipes by four families: McMichael's, Knepp's, Elmore's, and Ross's. Each family has a color-coded badge throughout the UI.
