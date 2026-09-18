/**
 * The parameters of an auth redirect, wherever Supabase put them.
 *
 * The implicit flow writes them after `#`, the PKCE flow after `?`, and a
 * custom-scheme URL (`szinhaztracker:///reset-password#access_token=…`) is
 * not something `new URL()` is guaranteed to parse the same way on every
 * runtime — so the two segments are cut off by hand. Fragment wins over
 * query when both name the same key, which is what a browser would see too.
 */
export function authLinkParams(url: string): URLSearchParams {
  const hash = url.indexOf("#");
  const fragment = hash >= 0 ? url.slice(hash + 1) : "";
  const beforeHash = hash >= 0 ? url.slice(0, hash) : url;
  const question = beforeHash.indexOf("?");
  const query = question >= 0 ? beforeHash.slice(question + 1) : "";
  const params = new URLSearchParams(query);
  for (const [key, value] of new URLSearchParams(fragment)) params.set(key, value);
  return params;
}
