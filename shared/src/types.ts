export type Status = 'paid' | 'confirmed' | 'booked' | 'todo' | 'estimated' | 'unverified';
export type TravelMode = 'WALK' | 'TRANSIT' | 'DRIVE' | 'BICYCLE';
export const TRAVEL_MODES: TravelMode[] = ['WALK', 'TRANSIT', 'DRIVE', 'BICYCLE'];

export interface LatLng {
  lat: number;
  lng: number;
}

export type LinkKind =
  | 'threads'
  | 'instagram'
  | 'youtube'
  | 'tiktok'
  | 'google-maps'
  | 'agoda'
  | 'airbnb'
  | 'web';

export interface LinkRef {
  url: string;
  kind: LinkKind;
  label?: string;
}

/** Opening hours in Places API (New) shape, trimmed to what we use. */
export interface OpeningPeriod {
  open: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
}

export interface ResolvedPlace {
  placeId?: string;
  name: string;
  address?: string;
  location?: LatLng;
  googleMapsUri?: string;
  photoUrl?: string;
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
  openingPeriods?: OpeningPeriod[];
  /** 'full' = Places API matched; 'partial' = only parsed from the URL. */
  quality: 'full' | 'partial';
}

export interface ResolvePlaceRequest {
  url: string;
}

export interface ResolvePlaceResponse {
  expandedUrl: string;
  place: ResolvedPlace | null;
  error?: string;
}

export interface RouteEndpoint {
  placeId?: string;
  location?: LatLng;
  /** Human-readable name; used when an AI lookup is needed. */
  name?: string;
}

export interface RouteRequest {
  origin: RouteEndpoint;
  destination: RouteEndpoint;
  mode: TravelMode;
  /** ISO timestamp, used for TRANSIT. */
  departureTime?: string;
}

export interface RouteSource {
  title: string;
  url: string;
}

export interface RouteResponse {
  durationSec: number | null;
  distanceM: number | null;
  summary?: string;
  /** 'ai' = Gemini + Google Search (Japan transit, which the Routes API doesn't cover). */
  source: 'routes-api' | 'ai' | 'estimate';
  fareYen?: number | null;
  transfers?: number | null;
  sources?: RouteSource[];
  error?: string;
}

export interface OEmbedResponse {
  html?: string;
  authorName?: string;
  title?: string;
  thumbnailUrl?: string;
  error?: string;
}

export interface LinkPreviewResponse {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  error?: string;
}
