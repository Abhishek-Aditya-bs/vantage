/**
 * Vantage wire protocol — shared by the Worker and the React client.
 * Zod schemas validate untrusted input at the Worker boundary; the inferred
 * TypeScript types give the client end-to-end type safety.
 */
import { z } from "zod";
import { MAX_DISPLAY_NAME, MAX_SPACE_NAME } from "./constants";

/* ------------------------------------------------------------------ roles */
export type Role = "host" | "guest";

/* ----------------------------------------------------------- core records */
export interface Member {
  memberId: string;
  displayName: string;
  role: Role;
  /** deterministic seed used to render the pixel-art avatar */
  avatarSeed: string;
  joinedAt: number;
}

export type MediaKind = "wall" | "moment";

export interface MediaMeta {
  id: string;
  kind: MediaKind;
  /** set when kind === "moment" — groups the multi-angle frames */
  momentId?: string;
  memberId: string;
  displayName: string;
  contentType: string;
  width: number;
  height: number;
  createdAt: number;
}

export interface SpacePublic {
  code: string;
  name: string;
  memberCount: number;
  mediaCount: number;
  createdAt: number;
}

/* --------------------------------------------------------- REST: requests */
export const CreateSpaceBody = z.object({
  name: z.string().trim().min(1).max(MAX_SPACE_NAME),
  hostName: z.string().trim().min(1).max(MAX_DISPLAY_NAME),
  turnstileToken: z.string().min(1).optional(),
});
export type CreateSpaceBody = z.infer<typeof CreateSpaceBody>;

export const JoinSpaceBody = z.object({
  displayName: z.string().trim().min(1).max(MAX_DISPLAY_NAME),
  turnstileToken: z.string().min(1).optional(),
});
export type JoinSpaceBody = z.infer<typeof JoinSpaceBody>;

/* -------------------------------------------------------- REST: responses */
export interface AuthResult {
  token: string;
  memberId: string;
  role: Role;
  space: SpacePublic;
  joinUrl: string;
}

export interface UploadResult {
  media: MediaMeta;
}

export interface MomentResult {
  momentId: string;
  /** server clock at which every client should capture */
  captureAtServer: number;
  serverNow: number;
}

/* --------------------------------------------- WebSocket: server -> client */
export type ServerMessage =
  | {
      type: "hello";
      you: Member;
      space: SpacePublic;
      members: Member[];
      wall: MediaMeta[];
    }
  | { type: "member_join"; member: Member }
  | { type: "member_leave"; memberId: string }
  | { type: "presence"; members: Member[] }
  | { type: "media_added"; media: MediaMeta }
  | { type: "media_removed"; mediaId: string }
  | {
      type: "moment_scheduled";
      momentId: string;
      captureAtServer: number;
      serverNow: number;
      triggeredBy: string;
    }
  | { type: "moment_collecting"; momentId: string }
  | { type: "moment_complete"; momentId: string; media: MediaMeta[] }
  | { type: "clock"; serverNow: number; echo: number }
  | { type: "rate_limited"; scope: string }
  | { type: "error"; message: string };

/* --------------------------------------------- WebSocket: client -> server */
export type ClientMessage =
  | { type: "clock_ping"; t0: number }
  | { type: "trigger_moment" }
  | { type: "ping" };

/* JWT capability-token claims (validated inside the Durable Object). */
export interface TokenClaims {
  iss: "vantage";
  aud: "vantage-app";
  sub: string; // memberId
  spaceCode: string;
  role: Role;
  displayName: string;
  avatarSeed: string;
  iat: number;
  exp: number;
}
