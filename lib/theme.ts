/**
 * Shared by the server-rendered layout and the client toggle.
 *
 * This deliberately lives outside any `"use client"` module: importing a value
 * from a client module into a server component yields a client-reference stub
 * rather than the string, which would silently corrupt the inline theme script.
 */
export const THEME_STORAGE_KEY = 'matbeea-theme';
