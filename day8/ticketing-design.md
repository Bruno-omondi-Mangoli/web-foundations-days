# TicketHub Design Document

TicketHub is a website that sells tickets for concerts and events. This document follows the six-part design framework: requirements, estimates, API, data model, architecture, and trade-offs.

## 1. Requirements

**Functional**

- Users can register and log in.
- Users can browse and search events.
- Users can view an event's seats and see which are available.
- Users can hold chosen seats for 10 minutes while they pay.
- Users can pay for held seats and receive their tickets.
- Users can view their tickets and orders.
- An unpaid hold expires and its seats go back on sale.

**Non-functional**

- **Speed:** event pages and seat maps load in under about 200 ms, even during a big sale.
- **Correctness:** a seat is never sold to two people and a paid ticket is never lost. This matters more than speed.
- **Fairness:** first come, first served, a limit of 4 seats per order, and rate limiting (`429`) against bots.
- **Availability:** 99.9% with no single point of failure.
- **Scalability:** survive 200,000 people trying to buy 20,000 seats in 10 minutes.
- **Security:** HTTPS, token authentication and password hashes. A payment provider handles card details.

**Non-goals:** refunds and ticket resale between users.

## 2. Estimates

Assumptions: 1 day is about 100,000 seconds, peak is 5x the average, each big-sale buyer makes about 10 requests, and a ticket record is about 500 bytes.

```text
NORMAL DAY
Page views:  50,000 visitors x 10 = 500,000 per day / 100,000 = about 5 per second (peak 25)
Tickets:     5,000 per day / 100,000 = about 0.05 per second (peak 0.25)
Storage:     5,000 x 500 bytes = 2.5 MB per day = about 0.9 GB per year

BIG SALE (10 minutes = 600 seconds)
Requests:    200,000 people x 10 = 2,000,000 / 600 = about 3,300 per second (peak 16,500)
Seat holds:  200,000 / 600 = about 330 per second (peak 1,700)
Seats sold:  at most 20,000, about 33 per second (peak 170). 180,000 people (90%) miss out.
```

**Comparison:** the big sale is about 650 times busier than a normal day. Most of the traffic is reads (people refreshing the seat map), and all the buyers compete for the same 20,000 seats at the same moment.

## 3. API

Base URL `https://api.tickethub.com`. JSON over HTTPS. Every request except login sends `Authorization: Bearer <token>`.

| Method | Path | Description | Success |
| --- | --- | --- | --- |
| POST | /auth/login | Log in and receive a token | 200 OK |
| GET | /events?search=rock | Browse and search events | 200 OK |
| GET | /events/{id} | Get one event | 200 OK |
| GET | /events/{id}/seats | View the seats and their status | 200 OK |
| POST | /events/{id}/holds | Hold seats for 10 minutes | 201 Created |
| DELETE | /events/{id}/holds | Release my held seats early | 204 No Content |
| POST | /orders | Pay for my held seats and buy the tickets | 201 Created |
| GET | /orders | View my orders and tickets | 200 OK |

Example: `POST /events/3/holds` with body `{"seatIds": [101, 102]}` replies `201 Created`:

```json
{ "seatIds": [101, 102], "expiresAt": "2026-10-20T18:10:00Z" }
```

If a seat was taken first, the reply is `409 Conflict`:

```json
{ "error": { "status": 409, "message": "Seat 102 is no longer available." } }
```

`POST /orders` with `{"eventId": 3, "paymentToken": "tok_123"}` buys the seats the user is holding for that event.

| Error | When |
| --- | --- |
| 400 Bad Request | More than 4 seats, or an invalid body |
| 401 Unauthorized | Missing or invalid token |
| 403 Forbidden | Trying to pay for seats held by someone else |
| 404 Not Found | The event does not exist |
| 409 Conflict | The seat is no longer available |
| 429 Too Many Requests | Too many requests too quickly (rate limiting) |
| 500 Internal Server Error | Something broke on the server |

## 4. Data model

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

CREATE TABLE events (
  id        INTEGER PRIMARY KEY,
  title     TEXT NOT NULL,
  venue     TEXT NOT NULL,
  starts_at TEXT NOT NULL
);

CREATE TABLE orders (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE seats (
  id              INTEGER PRIMARY KEY,
  event_id        INTEGER NOT NULL,
  label           TEXT NOT NULL,
  price_cents     INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'available'
                  CHECK (status IN ('available', 'held', 'sold')),
  held_by         INTEGER,
  hold_expires_at TEXT,
  order_id        INTEGER,
  UNIQUE (event_id, label),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (held_by)  REFERENCES users(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX idx_seats_event_status ON seats(event_id, status);
```

**Relationships**

- users to orders: one-to-many (`orders.user_id`).
- events to seats: one-to-many (`seats.event_id`).
- orders to seats: one-to-many (`seats.order_id`, empty until the seat is sold). A seat has only one `order_id`, so it can belong to at most one order.
- users to seats: a temporary hold is stored in `seats.held_by`.

**Index:** `seats(event_id, status)` makes the seat map query (all available seats of one event) fast instead of scanning every seat.

## 5. How double-booking is prevented

The database decides who gets a seat. The cache and the app code do not.

1. **One atomic conditional update.** Taking a seat is a single `UPDATE` that works only if the seat is still free, inside a transaction:

```sql
BEGIN TRANSACTION;
UPDATE seats
SET status = 'held', held_by = ?, hold_expires_at = ?
WHERE id = ?
  AND (status = 'available' OR (status = 'held' AND hold_expires_at < ?));
-- 0 rows changed means someone else got it first: ROLLBACK and reply 409
COMMIT;
```

2. **Isolation.** If two buyers go for the same seat at the same moment, the database runs their updates one after the other. The first changes the status to `held`. For the second, the `WHERE` no longer matches, so it changes 0 rows and that buyer gets `409 Conflict`.
3. **Atomicity.** When someone holds several seats, all of them are in one transaction, so they get all the seats or none.
4. **Paying.** The seat becomes `sold` with a second conditional update (`WHERE status = 'held' AND held_by = ? AND hold_expires_at > now`) in the same transaction that creates the order. An expired or foreign hold changes 0 rows, so nothing is sold.
5. **Constraints as a safety net.** `CHECK` limits the status values, `UNIQUE (event_id, label)` stops duplicate seat rows, and one `order_id` per seat means a seat can never be in two orders.
6. **Not the cache.** The cached seat map can be a few seconds out of date, so it is only for display. A click on a stale seat just gets a fast `409`. All holds and purchases go to the primary database, never to a replica, because replicas can lag.

## 6. Architecture

```text
CLIENT (browser / mobile app)
 |
 |--(1)--> DNS ............ tickethub.com -> IP addresses
 |--(2)--> CDN ............ HTML, CSS, JS, event images
 |--(3)--> LOAD BALANCER .. API calls (HTTPS, JSON, token), rate limiting
               |
               v
         WAITING ROOM (queue) ... big sale only: lets people in a batch at a time
               |
               v
         APP SERVER 1 | APP SERVER 2 | ... | APP SERVER N   (stateless)
               |
               |--(4) event and seat-map reads --> CACHE (Redis) --(miss)--> READ REPLICA
               |--(5) holds and purchases ------> PRIMARY DATABASE --(copies rows)--> READ REPLICA
               |--(6) payment ------------------> PAYMENT PROVIDER (external)
               |--(7) jobs ---------------------> QUEUE --> WORKER --> emails, e-tickets, expire holds
```

**What each component does**

- **Client:** shows events and seats and sends the requests, so tickets can be bought from any device.
- **DNS:** turns tickethub.com into the IP address so the client can find the system.
- **CDN:** serves static files and event images from edge servers near the user, which cuts latency and takes most of the bytes off our servers.
- **Load balancer:** spreads requests across the app servers, skips failed ones with health checks, and rate-limits abusive clients (`429`).
- **Waiting room:** during a big sale, lets people in a batch at a time so 200,000 users do not hit the servers at once.
- **App servers:** run the API code and, being stateless, can be added in large numbers before a sale.
- **Cache (Redis):** keeps event pages and seat maps (with a TTL of a few seconds) so most of the 16,500 requests per second are answered without touching the database.
- **Primary database:** holds the one true copy of the data and is the only place where seats are held and sold.
- **Read replica:** answers the reads that miss the cache and takes over if the primary fails (failover).
- **Payment provider:** takes the card payment so we never store card details.
- **Queue:** holds background jobs so the app server can reply immediately.
- **Worker:** sends emails, creates e-tickets and expires old holds in the background.

**How it survives the big sale**

- The CDN absorbs the static files, and the waiting room limits how many people reach the servers.
- App servers are scaled out before the sale starts, and they are stateless, so any server can handle any request.
- Seat maps come from the cache, and once the event is sold out, "sold out" is served from the cache so the 180,000 failed attempts do not hit the database.
- Only holds and purchases reach the primary database (about 1,700 simple updates per second at peak), and each touches one indexed seat row.

## 7. Trade-offs and bottleneck

- **Correctness versus speed:** buying must go through the single primary database, which is slower than a cache, but it is the only way to guarantee that a seat is never sold twice. For browsing we choose speed, and for buying we choose correctness.
- **Speed versus freshness:** the cached seat map may show a seat as free for a few seconds after it is taken. We accept this because the database rejects the click with `409`, so nobody is ever sold a taken seat.
- **Cost versus reliability:** extra app servers, replicas and a waiting room cost money and add complexity, so we scale up only for big sales and scale down afterwards.
- **Bottleneck:** the primary database is what breaks first, because all the writes for a hot event go to the same seat rows. Sharding is complex and only worth it when truly needed, and about 1,700 holds per second is manageable, so we do not shard yet.

