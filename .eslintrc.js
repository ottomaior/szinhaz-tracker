// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  ignorePatterns: ['/dist/*', '/supabase/functions/*'],
  rules: {
    // Introduced by eslint-config-expo 57 (react-hooks 6, the React Compiler
    // rules). It fires 22 times on code that did not change during the SDK 52
    // → 57 upgrade — every one of them a `setState` on a synchronous early-exit
    // branch inside an otherwise-async effect, e.g. clearing a rail to `[]` when
    // the session goes away, or copying a route param into state once the list
    // it indexes has loaded.
    //
    // They are real "derived state in an effect" smells and worth unpicking, but
    // doing it means restructuring state ownership across ten screens, which is
    // its own change with its own verification — not something to bury inside a
    // dependency upgrade whose whole value is that it changed no behaviour. Kept
    // visible as a warning rather than switched off, so the count can only go
    // down. See Phase 5.5 in BACKLOG.md.
    'react-hooks/set-state-in-effect': 'warn',
  },
};
