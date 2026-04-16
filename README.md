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
| [Spoonacular](https://spoonacular.com/food-api) | Stock recipe photo search | https://spoonacular.com/food-api/console |
| [Pollinations.ai](https://pollinations.ai) | AI image generation (FLUX models) | https://enter.pollinations.ai |

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
  ImageCropModal.tsx     # Web crop modal (16:9 aspect)
  StockPhotoPicker.tsx   # Spoonacular recipe photo search
  AIImageGenerator.tsx   # Pollinations.ai image generation

supabase/
  functions/
    generate-image/      # Edge function proxy for Pollinations (AI image gen)
    spoonacular-search/  # Edge function proxy for Spoonacular (stock photo search)
    usda-proxy/          # Edge function proxy for USDA FoodData Central (calorie lookup)

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
EXPO_PUBLIC_SITE_URL=<your-production-url>  # optional, used for password reset on native
```

Third-party API keys (USDA, Spoonacular, Pollinations) live server-side as
Supabase Edge Function secrets so they're never bundled into the client JS:

| Secret | Used by edge function |
|---|---|
| `USDA_API_KEY` | `usda-proxy` |
| `SPOONACULAR_API_KEY` | `spoonacular-search` |
| `POLLINATIONS_TOKEN` | `generate-image` |

Set each one in the Supabase dashboard under Edge Functions → Secrets. Disable
"Verify JWT" on each function (they're read-only proxies).

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

## Hero Photos

When adding a recipe, members can supply the cover photo three ways:

1. **Upload** their own photo (camera roll / file picker) — goes through a 16:9 crop modal on web
2. **Find stock photo** — searches Spoonacular's recipe database
3. **Generate with AI** — Pollinations.ai (FLUX) generates a photo from the recipe title and description

Stock and AI-generated images are flagged via `is_stock_image` / `is_ai_generated` columns and show a small badge on cards and the detail view (camera-with-slash for stock, sparkles for AI) so members know to swap in their own photo eventually.

The AI generator routes through a Supabase Edge Function (`supabase/functions/generate-image`) so the Pollinations secret token stays server-side and CORS/origin restrictions don't block requests.
