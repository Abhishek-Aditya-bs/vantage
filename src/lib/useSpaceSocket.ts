/**
 * useSpaceSocket — the live connection to a Vantage space.
 *
 * Responsibilities:
 *  - open the WS at /api/spaces/:code/ws?t=<token>; auto-reconnect with backoff
 *  - clock sync: periodically send `clock_ping { t0 }`; on `clock` compute
 *      offset = serverNow - (t0 + rtt/2)  (smoothed), exposing serverTimeToLocal
 *  - maintain space/members/wall state from server messages
 *  - expose triggerMoment() (host) and optimistic media insertion
 *  - surface the latest moment (scheduled/collecting/complete) for the UI
 */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type {
  MediaMeta,
  Member,
  ServerMessage,
  SpacePublic,
} from "@shared/protocol";
import { WS_HEARTBEAT_MS } from "@shared/constants";
import { api } from "@/lib/api";

export type SocketStatus =
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed"
  | "error";

export type MomentPhase = "scheduled" | "collecting" | "complete";

export interface ActiveMoment {
  momentId: string;
  phase: MomentPhase;
  /** server clock at which every client must capture (scheduled/collecting) */
  captureAtServer?: number;
  triggeredBy?: string;
  /** populated when phase === 'complete' */
  media?: MediaMeta[];
}

interface SpaceState {
  you: Member | null;
  space: SpacePublic | null;
  members: Member[];
  /** active (connected) member ids for presence rings */
  activeIds: Set<string>;
  wall: MediaMeta[];
}

type Action =
  | { type: "hello"; you: Member; space: SpacePublic; members: Member[]; wall: MediaMeta[] }
  | { type: "member_join"; member: Member }
  | { type: "member_leave"; memberId: string }
  | { type: "presence"; members: Member[] }
  | { type: "media_added"; media: MediaMeta }
  | { type: "media_removed"; mediaId: string }
  | { type: "optimistic_media"; media: MediaMeta }
  | { type: "reset" };

const EMPTY: SpaceState = {
  you: null,
  space: null,
  members: [],
  activeIds: new Set(),
  wall: [],
};

/** Insert media de-duped, newest first (server createdAt descending). */
function upsertMedia(wall: MediaMeta[], media: MediaMeta): MediaMeta[] {
  // Replace an optimistic placeholder (temp id) or dedupe by real id.
  const withoutDup = wall.filter(
    (m) => m.id !== media.id && m.id !== `temp:${media.id}`,
  );
  // Also drop any temp item from the same member created very recently.
  const cleaned = withoutDup.filter(
    (m) =>
      !(
        m.id.startsWith("temp:") &&
        m.memberId === media.memberId &&
        Math.abs(m.createdAt - media.createdAt) < 15000
      ),
  );
  return [media, ...cleaned].sort((a, b) => b.createdAt - a.createdAt);
}

function reducer(state: SpaceState, action: Action): SpaceState {
  switch (action.type) {
    case "hello":
      return {
        you: action.you,
        space: action.space,
        members: action.members,
        activeIds: new Set(action.members.map((m) => m.memberId)),
        wall: [...action.wall].sort((a, b) => b.createdAt - a.createdAt),
      };
    case "member_join": {
      const exists = state.members.some(
        (m) => m.memberId === action.member.memberId,
      );
      const activeIds = new Set(state.activeIds);
      activeIds.add(action.member.memberId);
      return {
        ...state,
        members: exists ? state.members : [...state.members, action.member],
        activeIds,
        space: state.space
          ? { ...state.space, memberCount: exists ? state.space.memberCount : state.space.memberCount + 1 }
          : state.space,
      };
    }
    case "member_leave": {
      const activeIds = new Set(state.activeIds);
      activeIds.delete(action.memberId);
      return { ...state, activeIds };
    }
    case "presence": {
      const activeIds = new Set(action.members.map((m) => m.memberId));
      // merge any members we hadn't seen before
      const known = new Map(state.members.map((m) => [m.memberId, m]));
      for (const m of action.members) known.set(m.memberId, m);
      return { ...state, members: [...known.values()], activeIds };
    }
    case "media_added":
      return {
        ...state,
        wall: upsertMedia(state.wall, action.media),
        space: state.space
          ? { ...state.space, mediaCount: state.space.mediaCount + 1 }
          : state.space,
      };
    case "optimistic_media":
      return { ...state, wall: upsertMedia(state.wall, action.media) };
    case "media_removed":
      return {
        ...state,
        wall: state.wall.filter((m) => m.id !== action.mediaId),
      };
    case "reset":
      return EMPTY;
    default:
      return state;
  }
}

export interface UseSpaceSocket extends SpaceState {
  status: SocketStatus;
  /** active synchronized Moment, if any */
  moment: ActiveMoment | null;
  /** convert a server timestamp into local (performance/Date) clock ms */
  serverTimeToLocal: (serverTs: number) => number;
  /** current best estimate of clock offset (serverNow - localNow), ms */
  clockOffset: number;
  /** host-only: ask the server to schedule a Moment */
  triggerMoment: () => Promise<void>;
  /** optimistically place media on the wall before the server echoes it */
  pushOptimistic: (media: MediaMeta) => void;
  /** clear a completed moment overlay */
  dismissMoment: () => void;
}

export function useSpaceSocket(
  code: string,
  token: string | null,
): UseSpaceSocket {
  const [state, dispatch] = useReducer(reducer, EMPTY);
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const [moment, setMoment] = useState<ActiveMoment | null>(null);
  const [clockOffset, setClockOffset] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const offsetRef = useRef(0);
  const reconnectRef = useRef(0);
  const closedByUs = useRef(false);
  const pingTimer = useRef<number | undefined>(undefined);
  const heartbeatTimer = useRef<number | undefined>(undefined);
  const reconnectTimer = useRef<number | undefined>(undefined);

  const serverTimeToLocal = useCallback(
    (serverTs: number) => serverTs - offsetRef.current,
    [],
  );

  const sendClockPing = useCallback(() => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "clock_ping", t0: Date.now() }));
    }
  }, []);

  const pushOptimistic = useCallback((media: MediaMeta) => {
    dispatch({ type: "optimistic_media", media });
  }, []);

  const dismissMoment = useCallback(() => setMoment(null), []);

  const triggerMoment = useCallback(async () => {
    // REST trigger; the server then broadcasts moment_scheduled to everyone
    // (including us), so we don't optimistically set state here.
    await api.triggerMoment(code);
  }, [code]);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }
    closedByUs.current = false;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const url = `${proto}://${location.host}/api/spaces/${encodeURIComponent(
        code,
      )}/ws?t=${encodeURIComponent(token)}`;
      setStatus(reconnectRef.current > 0 ? "reconnecting" : "connecting");

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectRef.current = 0;
        setStatus("open");
        sendClockPing();
        // periodic clock sync + heartbeat to keep the socket warm
        window.clearInterval(pingTimer.current);
        pingTimer.current = window.setInterval(sendClockPing, 8000);
        window.clearInterval(heartbeatTimer.current);
        heartbeatTimer.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, WS_HEARTBEAT_MS);
      };

      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(ev.data as string) as ServerMessage;
        } catch {
          return;
        }
        handleMessage(msg);
      };

      ws.onerror = () => {
        // onclose will follow and drive reconnect
        setStatus((s) => (s === "open" ? "reconnecting" : "error"));
      };

      ws.onclose = () => {
        window.clearInterval(pingTimer.current);
        window.clearInterval(heartbeatTimer.current);
        if (closedByUs.current) {
          setStatus("closed");
          return;
        }
        setStatus("reconnecting");
        // exponential backoff capped at 8s, with jitter
        const attempt = ++reconnectRef.current;
        const delay = Math.min(8000, 500 * 2 ** attempt) + Math.random() * 300;
        reconnectTimer.current = window.setTimeout(connect, delay);
      };
    };

    const handleMessage = (msg: ServerMessage) => {
      switch (msg.type) {
        case "hello":
          dispatch({
            type: "hello",
            you: msg.you,
            space: msg.space,
            members: msg.members,
            wall: msg.wall,
          });
          break;
        case "member_join":
          dispatch({ type: "member_join", member: msg.member });
          break;
        case "member_leave":
          dispatch({ type: "member_leave", memberId: msg.memberId });
          break;
        case "presence":
          dispatch({ type: "presence", members: msg.members });
          break;
        case "media_added":
          dispatch({ type: "media_added", media: msg.media });
          break;
        case "media_removed":
          dispatch({ type: "media_removed", mediaId: msg.mediaId });
          break;
        case "moment_scheduled":
          setMoment({
            momentId: msg.momentId,
            phase: "scheduled",
            captureAtServer: msg.captureAtServer,
            triggeredBy: msg.triggeredBy,
          });
          break;
        case "moment_collecting":
          setMoment((m) =>
            m && m.momentId === msg.momentId
              ? { ...m, phase: "collecting" }
              : m,
          );
          break;
        case "moment_complete":
          setMoment({
            momentId: msg.momentId,
            phase: "complete",
            media: msg.media,
          });
          break;
        case "clock": {
          // offset = serverNow - (t0 + rtt/2); smooth with a light EMA
          const now = Date.now();
          const rtt = now - msg.echo;
          const sample = msg.serverNow - (msg.echo + rtt / 2);
          const prev = offsetRef.current;
          const next = prev === 0 ? sample : prev * 0.8 + sample * 0.2;
          offsetRef.current = next;
          setClockOffset(next);
          break;
        }
        case "rate_limited":
        case "error":
          // surfaced through status only; UI toasts handle user-facing cases
          break;
      }
    };

    connect();

    return () => {
      closedByUs.current = true;
      window.clearInterval(pingTimer.current);
      window.clearInterval(heartbeatTimer.current);
      window.clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
      dispatch({ type: "reset" });
    };
  }, [code, token, sendClockPing]);

  return {
    ...state,
    status,
    moment,
    serverTimeToLocal,
    clockOffset,
    triggerMoment,
    pushOptimistic,
    dismissMoment,
  };
}
