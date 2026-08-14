"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPlus, Check, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { api, type FriendsResponse } from "@/lib/client/api";

export default function FriendsPage() {
  const [data, setData] = useState<FriendsResponse | null>(null);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<FriendsResponse>("/api/friends");
    if (res.ok) setData(res.data!);
    else setNeedsAuth(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sendRequest = async () => {
    if (!username.trim()) return;
    const res = await api.post<{ ok: boolean; autoAccepted: boolean }>(
      "/api/friends/request",
      { username: username.trim() },
    );
    setMessage(
      res.ok
        ? res.data?.autoAccepted
          ? `You're now friends with ${username.trim()}`
          : `Request sent to ${username.trim()}`
        : (res.error?.message ?? "Could not send request"),
    );
    setUsername("");
    void load();
    setTimeout(() => setMessage(null), 3000);
  };

  const respond = async (key: string, action: "accept" | "decline") => {
    await api.post(`/api/friends/${key}?action=${action}`);
    void load();
  };

  if (needsAuth) {
    return (
      <AppShell>
        <p className="py-20 text-center text-sm text-text-tertiary">
          Log in to manage friends
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-3 text-lg font-bold">Friends</h1>

        <div className="mb-6 flex gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendRequest()}
            placeholder="Add by username…"
            className="flex-1 rounded-xl bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-text-tertiary focus:ring-1 focus:ring-betclic-red"
          />
          <button
            onClick={sendRequest}
            className="rounded-xl bg-betclic-red px-4 text-sm font-bold text-white hover:bg-betclic-red-dark"
          >
            <UserPlus size={16} />
          </button>
        </div>

        {message && (
          <p className="mb-4 rounded-xl bg-surface p-3 text-center text-xs text-text-secondary">
            {message}
          </p>
        )}

        {data && data.incoming.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Requests
            </h2>
            {data.incoming.map((r) => (
              <div
                key={r.friendshipKey}
                className="mb-2 flex items-center justify-between rounded-xl bg-surface p-3"
              >
                <span className="text-sm">{r.username}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => respond(r.friendshipKey, "accept")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-win/20 text-win"
                    aria-label="Accept"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => respond(r.friendshipKey, "decline")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-lose/15 text-lose"
                    aria-label="Decline"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Your friends
          </h2>
          {data?.friends.length === 0 && (
            <p className="rounded-xl bg-surface p-6 text-center text-sm text-text-tertiary">
              No friends yet — try adding a bot like <b>OddOwl</b> or <b>LuckyLion</b>
            </p>
          )}
          {data?.friends.map((f) => (
            <div
              key={f.friendshipKey}
              className="mb-2 flex items-center justify-between rounded-xl bg-surface p-3"
            >
              <span className="text-sm font-medium">{f.username}</span>
              <span className="text-xs tabular-nums text-win">
                {f.totalWon.toLocaleString()} pts won
              </span>
            </div>
          ))}
        </section>

        {data && data.outgoing.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Pending invites
            </h2>
            {data.outgoing.map((o) => (
              <div
                key={o.friendshipKey}
                className="mb-2 flex items-center justify-between rounded-xl bg-surface p-3 text-text-secondary"
              >
                <span className="text-sm">{o.username}</span>
                <span className="text-[11px]">Awaiting response…</span>
              </div>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}
