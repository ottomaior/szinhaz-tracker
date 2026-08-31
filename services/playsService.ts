import { plays, venues, reviews, watchlist, feed, users, currentUser } from "@/data/mockData";
import type { Play, Venue, Review, FeedItem, User } from "@/data/types";

/**
 * Data-access boundary. Every function here is `async` and returns exactly
 * what the mock arrays hold today — on purpose, so that swapping the body
 * of each function for a real network call (once the scraping/crowd-source
 * pipeline exists) never touches a screen component. Screens only ever
 * import from this file, never from data/mockData directly.
 */

const LATENCY_MS = 0; // set to e.g. 250 to rehearse loading states

function resolve<T>(value: T): Promise<T> {
  return new Promise((res) => setTimeout(() => res(value), LATENCY_MS));
}

export async function getFeed(): Promise<FeedItem[]> {
  return resolve(feed);
}

export async function getTrending(): Promise<Play[]> {
  return resolve([...plays].sort((a, b) => b.rating.overall - a.rating.overall));
}

export async function getPremieres(): Promise<Play[]> {
  const now = new Date();
  return resolve(
    [...plays]
      .filter((p) => new Date(p.premiereDate) >= now)
      .sort((a, b) => +new Date(a.premiereDate) - +new Date(b.premiereDate))
  );
}

export async function getPlayById(id: string): Promise<Play | undefined> {
  return resolve(plays.find((p) => p.id === id));
}

export async function getVenueById(id: string): Promise<Venue | undefined> {
  return resolve(venues.find((v) => v.id === id));
}

export async function getReviewsForPlay(playId: string): Promise<Review[]> {
  return resolve(reviews.filter((r) => r.playId === playId));
}

export async function getUserById(id: string): Promise<User | undefined> {
  return resolve(users.find((u) => u.id === id));
}

export async function getWatchlist(): Promise<{ play: Play; addedAt: string }[]> {
  const items = watchlist
    .map((w) => {
      const play = plays.find((p) => p.id === w.playId);
      return play ? { play, addedAt: w.addedAt } : undefined;
    })
    .filter((x): x is { play: Play; addedAt: string } => !!x);
  return resolve(items);
}

export async function getCurrentUser(): Promise<User> {
  return resolve(currentUser);
}

export async function getDiaryPlaysForUser(_userId: string): Promise<Play[]> {
  // MVP: everyone's diary shows the full sample catalog so the Profile
  // screen's grid has content; replace with a real check-in history query.
  return resolve(plays);
}
