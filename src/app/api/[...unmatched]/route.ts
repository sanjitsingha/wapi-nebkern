import { NextResponse } from 'next/server';

// A 404 for unmatched /api/* paths, so they never fall through to the
// app router's not-found.
//
// src/app/not-found.tsx redirects a missing PAGE to /dashboard or / —
// which is right for a human who mistyped a URL, and wrong for an API
// client. Without this, a call to a mistyped endpoint got a 307 to the
// landing page, and a client that follows redirects then read a 200 of
// HTML: `res.ok` true, `res.json()` throwing on "<!DOCTYPE". A 404 is
// what a caller can actually act on.
//
// Next matches static and single-segment dynamic routes ahead of a
// catch-all, so every real endpoint still wins; only genuinely
// unrouted paths land here.
const notFound = () =>
  NextResponse.json({ error: 'Not found' }, { status: 404 });

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const HEAD = notFound;
export const OPTIONS = notFound;
