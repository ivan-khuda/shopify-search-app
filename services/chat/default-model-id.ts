/**
 * The built-in default chat model id (D-09). Lives in its own module with
 * zero imports so Client Components (settings model section) can read it
 * without dragging the prisma-importing resolver into the browser bundle.
 */
export const DEFAULT_MODEL_ID = 'google/gemini-2.5-flash';
