# Supabase setup for task materials and submissions

This feature uses a **private** Supabase Storage bucket and server-only Supabase database access. The Supabase secret/service-role key must never be added to frontend code or committed to GitHub.

## 1. Create the tables and private bucket

1. Open the Supabase project.
2. Go to **SQL Editor** and create a new query.
3. Copy all of `supabase/schema.sql` from this repository into the editor.
4. Run the query.

This creates the three metadata tables and a private `task-files` bucket. Files are limited to 10 MB each.

## 2. Add environment variables in Render

Open the existing Render service's **Environment** page and add:

- `SUPABASE_URL`: Project URL from Supabase **Project Settings → API**.
- `SUPABASE_SECRET_KEY`: the server-side secret key (`sb_secret_...`) from Supabase **Project Settings → API Keys**. The app also accepts the legacy `SUPABASE_SERVICE_ROLE_KEY` if that is what your project shows.
- `SUPABASE_STORAGE_BUCKET`: `task-files`.

Save changes. Render will restart/redeploy the service.

Do not send the service-role key in chat, put it in GitHub, or use it in any `VITE_...` variable.

## 3. Supported submissions

- PDF, DOC, DOCX, JPG, PNG and WEBP files.
- A reference or submission link beginning with `http://` or `https://`.
- Maximum file size: 10 MB per file.
- Storage is private. The app creates short-lived signed links after checking the logged-in user's access.

## Important database note

The existing accounts, classes and task assignments still use the app's SQLite database. This feature stores materials, submissions and reviews in Supabase, but it does **not** yet migrate the existing SQLite application database to PostgreSQL. Keep a separate backup of the existing app data; a full database migration should be handled as a separate, carefully verified step.
