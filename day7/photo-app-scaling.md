# SnapShare Scaling Plan

SnapShare is a photo-sharing app: users upload photos and scroll a feed of photos from people they follow.

## 1. Assumptions

- 10,000,000 registered users, 10% active each day, so **1,000,000 daily active users (DAU)**.
- Each active user uploads 1 photo and views 50 feed pages per day (one feed page = one `GET /feed` request).
- A photo is 2 MB and its thumbnail is 50 KB.
- 1 day is about 100,000 seconds, peak traffic is 5x the average, and 1 TB = 1,000 GB.
- A database record per photo is about 500 bytes.

## 2. Estimates

```text
Uploads:     1,000,000 per day / 100,000  = about 10 per second (peak about 50)
Feed views:  1,000,000 x 50 = 50,000,000 per day / 100,000
                                          = about 500 per second (peak about 2,500)
Photos:      1,000,000 x 2 MB = 2 TB per day x 365  = about 730 TB per year
Thumbnails:  1,000,000 x 50 KB = 50 GB per day x 365 = about 18 TB per year
Total files: about 750 TB per year
DB records:  1,000,000 x 500 bytes = 500 MB per day x 365 = about 180 GB per year
```

## 3. Read-heavy or write-heavy?

**Read-heavy**: about 500 feed views for every 10 uploads, a ratio of about 50 to 1. This means: cache the feeds (with an 80% hit rate only about 500 of the 2,500 peak views per second reach the database), use read replicas for cache misses, serve files from a CDN, and scale out stateless app servers. Uploads are few but heavy (2 MB each, about 20 MB per second), so the files go to object storage and slow work goes to a queue.

## 4. Why photos are not stored in the database

A photo is 2 MB but a database row is about 500 bytes. Storing the files in the database would make it grow by about 750 TB per year instead of 180 GB and slow down queries, backups and replication. Photos go to **object storage** (such as Amazon S3), which is built to keep large files permanently. The database stores only a **link** to each file.

## 5. Architecture diagram

```text
USERS (browser / mobile app)
 |
 |--(1)--> DNS .............. snapshare.com -> IP address
 |--(2)--> CDN --(cache miss)--> OBJECT STORAGE   (HTML, CSS, JS, photos, thumbnails)
 |--(3)--> LOAD BALANCER .... API calls (HTTPS, JSON, token)
               |
               v
         APP SERVERS: App 1 | App 2 | App 3 ...  (stateless)
               |
               |--(4) feed reads --> CACHE (Redis) --(miss)--> READ REPLICA
               |--(5) photo rows --> PRIMARY DATABASE --(copies rows)--> READ REPLICA
               |--(6) save files --> OBJECT STORAGE (originals 2 MB, thumbnails 50 KB)
               |--(7) add job -----> QUEUE --> WORKER --> reads original and saves
                                                          50 KB thumbnail in OBJECT STORAGE,
                                                          marks photo ready in PRIMARY DATABASE

Load: about 10 uploads/s and 500 feed views/s (peak 50 and 2,500), about 750 TB of files per year.
```

## 6. What each component does

- **DNS:** turns snapshare.com into the system's IP address so browsers can find it.
- **CDN:** keeps copies of static files and photos on edge servers near users, which cuts latency and load on our servers.
- **Load balancer:** spreads requests over the app servers and uses health checks to skip failed ones, so no single server is a single point of failure.
- **App servers:** run the API code and, being stateless, can be added in numbers to handle more traffic (a few dozen at peak, a rough figure scaled up from QuickNotes).
- **Cache (Redis):** keeps hot feeds in memory so most feed views are answered in about 1 ms without touching the database.
- **Primary database:** holds the one true copy of users, follows and photo records and takes all the writes.
- **Read replica:** holds a copy of the primary's data and answers the reads that miss the cache, so the primary is not overloaded.
- **Object storage:** keeps the large photo and thumbnail files permanently so they stay out of the database.
- **Queue:** holds "create thumbnail" jobs so the app server can reply immediately instead of waiting for slow work.
- **Worker:** takes jobs from the queue in the background and creates thumbnails, so a burst of uploads waits in the queue instead of overloading the system.

## 7. Upload flow, step by step

1. The client sends `POST /photos` with the file over HTTPS, with the token in the `Authorization` header.
2. The load balancer forwards the request to a healthy app server.
3. The app server checks the token and validates the upload (a photo, not too large).
4. It saves the original 2 MB file in object storage.
5. It writes a row to the primary database: user id, file link, date and thumbnail status "pending".
6. It adds a "create thumbnail" job to the queue and deletes the uploader's cached feed entry.
7. It replies `201 Created` immediately. The primary copies the new row to the read replica a few milliseconds later.
8. In the background, a worker takes the job from the queue, reads the original from object storage, creates the 50 KB thumbnail and saves it back.
9. The worker updates the photo row (thumbnail link, status "ready"). Feeds then load the thumbnail from the CDN, and show a placeholder until it is ready.

## 8. Trade-offs

- **Speed versus freshness:** the cache and read replicas make feeds fast but can be slightly out of date (cache TTL, replication lag, eventual consistency). A feed that is a minute old is fine for photos.
- **Cost versus reliability:** extra app servers, replicas, a CDN and about 750 TB of storage per year cost money, but they keep the app fast and online when parts fail.
- **Simplicity versus scalability:** the cache, queue and replicas add complexity (stale data, retries, more to debug) compared with one server, but they are needed at this scale. We still avoid sharding (180 GB per year fits one database) and microservices.
- **Upload speed versus instant thumbnails:** background thumbnails keep uploads fast, but a new photo briefly shows a placeholder.
