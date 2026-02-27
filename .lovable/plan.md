

## Diagnosis

The `redirect_uri_mismatch` error on `flow.hayasmarketing.com` is caused by the Lovable Cloud auth-bridge, which handles OAuth for `*.lovable.app` domains but is incompatible with custom domains. This may have broken due to a change in the auth-bridge behavior.

## Fix

**File: `src/contexts/AuthContext.tsx`** — Update `signInWithGoogle` to detect custom domains and bypass the auth-bridge:

- If on a custom domain (not `*.lovable.app`), use `supabase.auth.signInWithOAuth` directly with `skipBrowserRedirect: true`, then manually redirect to the OAuth URL
- If on a Lovable domain, keep using `lovable.auth.signInWithOAuth` as before

**File: `src/pages/Auth.tsx`** — No changes needed (the `handleGoogleSignIn` already calls `signInWithGoogle` from context)

### Implementation detail

```typescript
const signInWithGoogle = async () => {
  try {
    const isCustomDomain =
      !window.location.hostname.includes("lovable.app") &&
      !window.location.hostname.includes("lovableproject.com");

    if (isCustomDomain) {
      // Bypass auth-bridge for custom domains
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: true,
          queryParams: { hd: 'hayas.es' },
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } else {
      // Lovable domains use managed auth-bridge
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { hd: 'hayas.es' },
      });
      if (error) throw error;
    }
    return { error: null };
  } catch (error: any) {
    // existing error handling
    return { error };
  }
};
```

This is a single-file change in `AuthContext.tsx`, ~15 lines modified.

