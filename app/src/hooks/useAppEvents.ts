import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";

const BASE_URL = import.meta.env.VITE_API_URL || "";

interface AppEvent {
  scope: "user" | "team" | "org";
  type: string;
  data: unknown;
}

/**
 * Connects to the scoped SSE endpoint. The server only delivers events
 * matching this user's identity (user/team/org scope filtering).
 *
 * Routes events to the appropriate TanStack Query invalidations.
 */
export function useAppEvents() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      const token = await getToken();
      if (cancelled) return;

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`${BASE_URL}/api/documents/events`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const evt = JSON.parse(line.slice(6)) as AppEvent;
                handleEvent(evt);
              } catch {
                // ignore malformed lines
              }
            }
          }
        }
      } catch (err: unknown) {
        if (!cancelled && !(err instanceof DOMException && err.name === "AbortError")) {
          setTimeout(() => {
            if (!cancelled) connect();
          }, 3000);
        }
      }
    }

    function handleEvent(evt: AppEvent) {
      switch (evt.type) {
        case "document.status":
          queryClient.invalidateQueries({ queryKey: ["documents"] });
          break;
        case "project.parsed": {
          const data = evt.data as { project_id?: string };
          queryClient.invalidateQueries({ queryKey: ["projects"] });
          if (data?.project_id) {
            queryClient.invalidateQueries({ queryKey: ["project", data.project_id] });
            queryClient.invalidateQueries({ queryKey: ["questions", data.project_id] });
          }
          break;
        }
        case "notification.new":
          queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          break;
      }
    }

    connect();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [getToken, queryClient]);
}
