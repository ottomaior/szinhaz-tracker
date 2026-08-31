import type { Play, Venue, User, Review, WatchlistEntry, FeedItem } from "./types";

/**
 * Hand-written sample data standing in for the real database. Every
 * entity here shares the exact shape the eventual scraped/crowd-sourced
 * database will need to populate (see data/types.ts) — swapping this file
 * for a real API client in services/ is meant to be a small, mechanical
 * change, not a rewrite.
 */

export const venues: Venue[] = [
  { id: "v1", name: "Örkény István Színház", type: "kőszínház", city: "Budapest" },
  { id: "v2", name: "Katona József Színház", type: "kőszínház", city: "Budapest" },
  { id: "v3", name: "Vígszínház", type: "kőszínház", city: "Budapest" },
  { id: "v4", name: "Radnóti Színház", type: "kőszínház", city: "Budapest" },
  { id: "v5", name: "Nemzeti Színház", type: "kőszínház", city: "Budapest" },
  { id: "v6", name: "Trafó", type: "befogadó tér", city: "Budapest" },
];

export const users: User[] = [
  {
    id: "u1",
    name: "Nagy Boglárka",
    handle: "boglarka_szinhaz",
    city: "Budapest",
    initials: "NB",
    stats: { playsSeen: 127, thisYear: 31, followers: 412, following: 88 },
  },
  { id: "u2", name: "Kiss Anna", handle: "kiss_anna", city: "Budapest", initials: "KA", stats: { playsSeen: 64, thisYear: 22, followers: 140, following: 96 } },
  { id: "u3", name: "Balogh Máté", handle: "balogh_mate", city: "Szeged", initials: "BM", stats: { playsSeen: 38, thisYear: 12, followers: 51, following: 60 } },
];

export const plays: Play[] = [
  {
    id: "p1",
    title: "A padlás",
    author: "Presser Gábor / Sztevanovity Dusán",
    director: "Novák Eszter",
    venueId: "v1",
    genre: "musical",
    runtimeMinutes: 140,
    intermissions: 1,
    premiereDate: "2025-09-05",
    cast: [
      { name: "Pogány Judit", role: "Nagymama" },
      { name: "Csuja Imre", role: "Nagypapa" },
      { name: "Für Anikó", role: "Anya" },
    ],
    rating: { overall: 4.6, acting: 4.7, directing: 4.3, setDesign: 3.9, count: 312 },
  },
  {
    id: "p2",
    title: "Csongor és Tünde",
    author: "Vörösmarty Mihály",
    director: "Zsótér Sándor",
    venueId: "v3",
    genre: "drama",
    runtimeMinutes: 165,
    intermissions: 1,
    premiereDate: "2026-09-12",
    cast: [{ name: "Szávai Viktória", role: "Tünde" }],
    rating: { overall: 4.3, acting: 4.2, directing: 4.4, setDesign: 4.0, count: 98 },
  },
  {
    id: "p3",
    title: "Az ember tragédiája",
    author: "Madách Imre",
    director: "Vidnyánszky Attila",
    venueId: "v5",
    genre: "drama",
    runtimeMinutes: 195,
    intermissions: 1,
    premiereDate: "2026-09-04",
    cast: [{ name: "Ivo Elek Menyhért", role: "Ádám" }],
    rating: { overall: 4.1, acting: 4.0, directing: 4.1, setDesign: 4.5, count: 61 },
  },
  {
    id: "p4",
    title: "János vitéz",
    author: "Petőfi Sándor",
    director: "Szikora János",
    venueId: "v2",
    genre: "musical",
    runtimeMinutes: 130,
    intermissions: 1,
    premiereDate: "2026-09-01",
    cast: [{ name: "Szabó P. Szilveszter", role: "János" }],
    rating: { overall: 4.4, acting: 4.5, directing: 4.2, setDesign: 4.1, count: 40 },
  },
  {
    id: "p5",
    title: "Liliom",
    author: "Molnár Ferenc",
    director: "Réczei Tamás",
    venueId: "v4",
    genre: "drama",
    runtimeMinutes: 150,
    intermissions: 1,
    premiereDate: "2026-09-18",
    cast: [{ name: "Mészáros Béla", role: "Liliom" }],
    rating: { overall: 4.0, acting: 3.9, directing: 4.0, setDesign: 3.8, count: 22 },
  },
  {
    id: "p6",
    title: "Sirály",
    author: "Anton Csehov",
    director: "Máté Gábor",
    venueId: "v2",
    genre: "drama",
    runtimeMinutes: 170,
    intermissions: 1,
    premiereDate: "2025-11-20",
    cast: [{ name: "Bodrogi Gyula", role: "Szorin" }],
    rating: { overall: 4.8, acting: 4.9, directing: 4.7, setDesign: 4.4, count: 205 },
  },
  {
    id: "p7",
    title: "Marat/Sade",
    author: "Peter Weiss",
    director: "Panov Bertalan",
    venueId: "v6",
    genre: "physical theatre",
    runtimeMinutes: 110,
    intermissions: 0,
    premiereDate: "2026-03-14",
    cast: [{ name: "Terhes Sándor", role: "Marat" }],
    rating: { overall: 4.1, acting: 4.0, directing: 4.3, setDesign: 4.2, count: 33 },
  },
];

export const reviews: Review[] = [
  {
    id: "r1",
    playId: "p1",
    userId: "u2",
    createdAt: "2026-08-31T09:00:00.000Z",
    ratingOverall: 5,
    ratingActing: 5,
    ratingDirecting: 4,
    ratingSetDesign: 4,
    text: "Álomszerű díszlet, és Pogány Judit alakítása mindent visz. Könnyekig meghatódtam a második felvonásban.",
    tags: ["Standing ovation", "Cried"],
    likeCount: 24,
    commentCount: 3,
  },
  {
    id: "r2",
    playId: "p6",
    userId: "u1",
    createdAt: "2026-08-20T19:30:00.000Z",
    ratingOverall: 5,
    text: "A legjobb Csehov-előadás, amit valaha láttam Budapesten.",
    tags: ["Would recommend"],
    likeCount: 51,
    commentCount: 6,
  },
];

export const watchlist: WatchlistEntry[] = [
  { playId: "p2", addedByUserId: "u3", addedAt: "2026-08-30T14:00:00.000Z" },
  { playId: "p4", addedByUserId: "u1", addedAt: "2026-08-25T10:00:00.000Z" },
  { playId: "p3", addedByUserId: "u1", addedAt: "2026-08-18T10:00:00.000Z" },
];

export const feed: FeedItem[] = [
  { kind: "checkin", review: reviews[0] },
  { kind: "watchlist", entry: watchlist[0] },
  { kind: "checkin", review: reviews[1] },
];

export const currentUser = users[0];
