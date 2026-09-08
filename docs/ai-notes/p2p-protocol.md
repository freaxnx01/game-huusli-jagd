# P2P protocol (Hüüsli-Jagd)

Transport: `src/net/webrtc.js` — manual WebRTC data channels, no signalling server,
no libraries. Signalling is copy-paste of two codes per guest. STUN only
(`stun.l.google.com:19302`, `stun1.l.google.com:19302`); no TURN, so it does not
work behind symmetric NATs / strict corporate firewalls (parked in TODO.md).

## Offer/answer flow (host + up to 3 guests)

One `RTCPeerConnection` and one data channel per guest. The host repeats the
following once per guest; each guest does it once.

```
Host                                     Guest
----                                     -----
host = createHost({ maxGuests: 3 })      guest = createGuest()
code = await host.makeOfferCode()
  (createOffer -> ICE gathering,
   capped at 3.5 s -> encode)
  --- copy offer code, send by chat/mail --->
                                         ans = await guest.answerOffer(code)
                                           (setRemote -> createAnswer -> ICE -> encode)
  <--- copy answer code back ---------------
await host.acceptAnswer(ans)
  (setRemote; channel opens shortly)
'connected' {guestId}                    'connected'
```

- Codes are `HJ1.` + base64(deflate-raw(JSON `{t, s}`)), fallback `HJ0.` + base64(JSON)
  when `CompressionStream` is missing. Whitespace/newlines in a pasted code are ignored.
  `decodeDescription` throws `Error('bad code')` on anything else.
- The host has exactly one *pending* offer at a time. Calling `makeOfferCode()` again
  discards an un-answered pending offer. Once `acceptAnswer()` succeeded the connection
  is *connecting* and is no longer discarded by a new `makeOfferCode()`, so the host can
  immediately produce the code for the next guest.
- `guestId` is a small integer (1, 2, 3, ...) assigned in the order channels open. It is
  a transport handle only; the lobby maps it to a seat.
- Failures: a pending/connecting connection that fails emits `pendingFailed {error}` on
  the host; an established one emits `disconnected {guestId}`. The guest gets
  `disconnected {reason: 'failed' | 'closed'}`. `closeAll()` / `close()` are idempotent
  and silence all events afterwards. `host.close(guestId)` (local kick) does not emit.
- Every received payload goes through `parseMessage`: must be JSON for a plain object
  with a non-empty string `t`; anything else is dropped (console.debug). No `eval`, no
  trust in the peer.

## Message protocol (game layer, on top of the transport)

All messages are JSON objects with a string `t`. Host is authoritative; guests never
apply an action themselves, they only propose it.

### Lobby

| Dir          | Message                     | Meaning |
| ------------ | --------------------------- | ------- |
| guest → host | `{t:'hello', name, custom}` | Sent right after `connected`. `custom` = name typed by the user (host keeps it) vs. auto-generated (host may rename on collision). Name is clipped to 18 chars. |
| host → guest | `{t:'lobby', names, you}`   | Current seat names (index = seat) and the recipient's seat index. Re-sent to everyone whenever the lobby changes. |
| host → guest | `{t:'full'}`                | No seat left (or game already running). Guest disconnects. |
| host → all   | `{t:'start', state}`        | Game begins; `state` is the full engine state. Guests switch to the board. |
| guest → host | `{t:'leave'}`               | Guest leaves the lobby voluntarily; host frees the seat and re-sends `lobby`. |

Seats: host is seat 0; guests get the next free seat on `hello`. In the lobby a leaving
guest's seat is removed and later seats shift down (host re-sends `lobby` with the new
`you`). CPU seats, if any, are appended by the host at start.

### Game

| Dir          | Message              | Meaning |
| ------------ | -------------------- | ------- |
| guest → host | `{t:'act', action}`  | Proposed engine action, e.g. `{type:'ROLL'}`, `{type:'BUY', square: 12}`. |
| host → all   | `{t:'state', state}` | Full authoritative state after every applied action (also after CPU/host moves and `TIME_UP`). Guests render it; they never derive state locally. |
| host → all   | `{t:'bye'}`          | Host ended the game / closed the lobby. Guests disconnect and return to the menu. |
| guest → host | `{t:'leave'}`        | Guest quits mid-game. Host marks the seat as left and continues. A dropped channel is treated the same as `leave`. |

### Host-side validation of `act`

For every `{t:'act', action}` from `guestId`:

1. Look up the sender's seat: `seat = seatOfGuest[guestId]`. Unknown guest → drop.
2. It must be that seat's turn: `state.turn.player === seat`. Otherwise drop (log at
   debug; do not disconnect — it is most likely a stale click).
3. `action` must be a plain object with a string `type`, and must appear in
   `legalActions(state)` (same `type` and, where present, same `square`). `TIME_UP` is
   never accepted from a guest; only the host clock emits it. Anything not in the legal
   list is dropped.
4. Apply with `reduce(state, action)` (which re-checks legality and throws otherwise;
   a throw is caught and the action dropped), then `broadcast({t:'state', state})`.

Guests therefore cannot act out of turn, act for another seat, or perform an illegal
move; the worst a hostile guest can do is spam, and steps 2/3 are cheap. State
snapshots are the full engine state (a few KB) — fine for a game of this size; no
delta encoding.

### Disconnect handling

- Host loses a guest (`disconnected {guestId}`): during the lobby, free the seat and
  re-send `lobby`; during the game, treat as `leave`: the host dispatches the host-only
  engine action `{type:'LEAVE', player: seat}` (sets `left`, ends that seat's turn if it
  was on turn, finishes the game when fewer than two seats remain active) and broadcasts
  the resulting `state` like any other. A finished game shows the end screen on every
  side; `bye` + `closeAll()` follow when the host leaves it (or the lobby, or a running
  game).
- Guest loses the host (`disconnected {reason}`): show a message and return to the
  menu. There is no reconnect; a new join requires a fresh offer/answer exchange.
