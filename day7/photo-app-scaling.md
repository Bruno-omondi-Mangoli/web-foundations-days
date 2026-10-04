# SnapShare Scaling Plan

SnapShare is a photo-sharing app where users upload photos and scroll a feed of photos from people they follow. This plan estimates the load for 10 million registered users and designs a system that can handle it.

## 1. Assumptions

- There are **10,000,000 registered users**.
- **10% are active each day**.
- Each active user **uploads 1 photo per day**.
- Each active user **views 50 feed pages per day**. One feed page is one `GET /feed` request. The photo files themselves are loaded from the CDN, not from the app servers.
- An average photo is **2 MB**, and each photo also gets a **50 KB thumbnail**.
- Rounding rules for estimates: 1 day is about **100,000 seconds**, peak traffic is **5×** the average, 1 KB = 1,000 bytes, 1 MB = 1,000 KB, 1 GB = 1,000 MB and 1 TB = 1,000 GB.
- The database stores only a small record per photo (owner, links to the files, date), about **500 bytes**, like a QuickNotes note.

Daily active users (DAU):

```text
10,000,000 registered users × 10% = 1,000,000 DAU
```

## 2. Estimates

```text
Uploads (writes):
  1,000,000 users × 1 photo      = 1,000,000 uploads per day
  1,000,000 ÷ 100,000            ≈ 10 uploads per second (average)
  10 × 5                         ≈ 50 uploads per second (peak)

Feed views (reads):
  1,000,000 users × 50 pages     = 50,000,000 feed views per day
  50,000,000 ÷ 100,000           ≈ 500 feed views per second (average)
  500 × 5                        ≈ 2,500 feed views per second (peak)

Photo storage per year:
  Originals:   1,000,000 photos × 2 MB   = 2,000,000 MB = 2 TB per day
               2 TB × 365                ≈ 730 TB per year
  Thumbnails:  1,000,000 photos × 50 KB  = 50,000,000 KB = 50 GB per day
               50 GB × 365               ≈ 18,250 GB ≈ 18 TB per year
  Total photo files                      ≈ 750 TB per year

Database storage per year (records only):
  1,000,000 photos × 500 bytes           = 500 MB per day
  500 MB × 365                           ≈ 180 GB per year
```

| Measure | Average | Peak (5×) |
| --- | --- | --- |
| Uploads per second | about 10 | about 50 |
| Feed views per second | about 500 | about 2,500 |

| Storage | Per year |
| --- | --- |
| Original photos (2 MB each) | about 730 TB |
| Thumbnails (50 KB each) | about 18 TB |
| Photo files in total | about 750 TB |
| Database records | about 180 GB |

## 3. Read-heavy or write-heavy?

SnapShare is **read-heavy**. There are about 500 feed views per second for every 10 uploads per second, a ratio of about **50 reads to 1 write**.

What this means for the design:

- **Cache the feeds.** Most reads can be answered from a cache in memory. If about 80% of feed views are cache hits, only about 20% of the 2,500 peak views per second, around 500 per second, reach the database.
- **Use read replicas.** The reads that miss the cache are spread across read replicas, while the single primary database handles only the writes.
- **Use a CDN for the photo files.** Thumbnails and photos are static files that are the same for every viewer, so they should be served from nearby edge servers.
- **Scale the app servers out.** The QuickNotes estimate needed a few servers for about 200 requests per second. SnapShare's peak of 2,500 per second is about 12 times bigger, so it needs a few dozen stateless app servers behind a load balancer (a rough figure, to be checked with real measurements).
- **Treat uploads as few but heavy.** Each upload is 2 MB, so 10 uploads per second is about 20 MB per second on average (about 100 MB per second at peak). The files go to object storage, and slow work such as thumbnails goes to a queue.

## 4. Why photos should not be stored inside the database

- A photo is about 2 MB, while a database row is about 500 bytes. Storing the files in the database would make it grow by about 750 TB per year instead of about 180 GB.
- A database should stay small and fast so it can find rows quickly and be backed up and copied to replicas easily. Large files would slow every one of those jobs down.
- **Object storage** (such as Amazon S3) is built to keep large files such as images permanently, and the CDN can read the files from it.
- So the database stores only a **link** (URL) to each photo and its thumbnail, and the files live in object storage.

## 5. Architecture diagram

```text
 USERS (browser / mobile app)
  │
  ├─(1)─> DNS            snapshare.com -> IP addresses
  │
  ├─(2)─> CDN ──(cache miss)──> OBJECT STORAGE
  │       HTML, CSS, JS, photos and thumbnails come from the nearest edge server
  │
  └─(3)─> LOAD BALANCER   API calls: HTTPS, JSON, token
              │  health checks, skips unhealthy servers
              v
   ┌────────────────────────────────────────────┐
   │ APP SERVERS (stateless, 3 or more)         │
   │ ┌───────┐ ┌───────┐ ┌───────┐              │
   │ │ App 1 │ │ App 2 │ │ App 3 │  ...         │
   │ └───────┘ └───────┘ └───────┘              │
   └──┬─────────────────────────────────────────┘
      │
      ├─(4)─ feed reads ────> CACHE (Redis) ──(miss)──> READ REPLICA
      │
      ├─(5)─ new photo rows ─> PRIMARY DATABASE ──(copies rows)──> READ REPLICA
      │
      ├─(6)─ save photo file ─> OBJECT STORAGE (originals 2 MB, thumbnails 50 KB)
      │
      └─(7)─ add job ────────> QUEUE ──> WORKER ──> reads the original from OBJECT STORAGE,
                                                    saves a 50 KB thumbnail back to it, and
                                                    updates the photo row in the PRIMARY DATABASE
```

Load estimate: about 10 uploads/s and 500 feed views/s on average, about 50 and 2,500 at peak, about 750 TB of photo files per year.

## 6. What each component does

- **DNS:** turns the name snapshare.com into the IP address of the system, so browsers can find it.
- **CDN:** keeps copies of the static files and photos on edge servers close to users, which lowers latency and takes load off our own servers.
- **Load balancer:** spreads requests across the app servers and uses health checks to stop sending traffic to a server that has failed, which removes a single point of failure.
- **App servers:** run the API code (check the token, validate data, talk to the cache, database, storage and queue) and, being stateless, can be added in numbers to handle more traffic.
- **Cache (Redis):** keeps recently used feeds in memory so most feed views are answered in about 1 ms without touching the database.
- **Primary database:** keeps the one true copy of the users, follows and photo records and accepts all the writes.
- **Read replica:** holds a copy of the primary's data and answers the reads that miss the cache, so the primary is not overloaded.
- **Object storage:** keeps the large photo and thumbnail files permanently and cheaply, so they do not have to live in the database.
- **Queue:** holds "create thumbnail" jobs so the app server can reply to the user immediately instead of waiting for slow work.
- **Worker:** takes jobs from the queue in the background and creates the thumbnails, so a burst of uploads waits in the queue instead of overloading the system.

## 7. Upload flow, step by step

1. The user picks a photo in the app, and the client sends `POST /photos` with the file over HTTPS, with the token in the `Authorization` header.
2. The **load balancer** forwards the request to a healthy app server.
3. The **app server** checks the token to find out who the user is, then validates the upload (for example, that it is a photo and not too large).
4. The app server saves the original 2 MB file in **object storage**.
5. It writes a new row to the **primary database** with the user's id, the link to the original file, the date and a "thumbnail pending" status. Only the primary accepts writes.
6. It adds a "create thumbnail for photo 123" job to the **queue**.
7. It deletes the uploader's cached feed entry from the **cache** so stale data is not served.
8. It replies right away with `201 Created`, so the user does not wait for the thumbnail. Within a few milliseconds the primary copies the new row to the **read replica**.
9. In the background, a **worker** takes the job from the queue, reads the original from object storage, creates the 50 KB thumbnail and saves it back to object storage.
10. The worker updates the photo row in the primary database with the thumbnail link and the status "ready", and clears the cached entry again.
11. When followers load their feed, the page gets the photo list from the cache or a read replica, and the browser downloads the thumbnails from the **CDN**. If a thumbnail is not ready yet, the app shows a placeholder.

## 8. Trade-offs

- **Speed versus freshness.** The cache and read replicas make feeds fast, but they can be slightly out of date. Followers may not see a new photo for up to the cache's TTL (for example 1 minute), and a replica may lag the primary by a few milliseconds (eventual consistency). A feed that is a minute out of date is acceptable for a photo app, so we accept it. For a bank balance, we would not.
- **Cost versus reliability.** Extra app servers, replicas and a CDN keep the app running if a part fails and make it faster, but they cost more money. Storing about 750 TB of photos a year in object storage is also a real cost. We pay for this because downtime or slow pages would drive users away.
- **Simplicity versus scalability.** One server is easy to build and understand, but it is a single point of failure and has a limit. A distributed design with a load balancer, cache, replicas and a queue scales much further but is harder to build, debug and run. At 10 million users the extra complexity is justified, and we still keep the app as one well-organised monolith instead of splitting it into microservices, and we do not shard the database, because about 180 GB of records per year fits in one well-configured database with replicas.
- **Speed of reply versus immediate thumbnails.** Creating thumbnails in the background keeps uploads fast, but a new photo may briefly show a placeholder instead of its thumbnail.

## 9. Keeping it reliable

- **Rate limiting:** restrict how many uploads and requests one user can make (extra requests get `429 Too Many Requests`), so a buggy script or attacker cannot overwhelm the system.
- **Retries and timeouts:** clients and servers use timeouts and retry failed requests with back-off, and because the app servers are stateless, a retry simply lands on a healthy server.
- **Graceful degradation:** if the thumbnail worker is down, uploads and feeds still work and photos show a placeholder until the thumbnails are ready.
- **Monitoring:** logs, metrics (requests per second, error rate, latency, cache hit rate) and alerts show problems before users notice them.
