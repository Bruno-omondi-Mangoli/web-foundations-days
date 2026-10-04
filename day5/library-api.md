# Library API Design

A RESTful API for a library's **books** resource. The resource is named with a plural noun (`/books`), the HTTP method says what to do, and a single book is addressed by its id (`/books/42`). All request and response bodies are JSON, so requests with a body send the header `Content-Type: application/json`.

## Endpoints

### 1. List all books

- **Method:** `GET`
- **Path:** `/books`
- **Description:** Returns a list of all books in the library.
- **Request body:** none
- **Success status:** `200 OK`

### 2. Get one book

- **Method:** `GET`
- **Path:** `/books/{id}` (for example `/books/42`)
- **Description:** Returns the book with the given id.
- **Request body:** none
- **Success status:** `200 OK`

### 3. Create a book

- **Method:** `POST`
- **Path:** `/books`
- **Description:** Adds a new book to the library.
- **Success status:** `201 Created`
- **Example request body:**

```json
{
  "title": "Things Fall Apart",
  "author": "Chinua Achebe",
  "isbn": "9780385474542",
  "year": 1958,
  "available": true
}
```

### 4. Replace a book

- **Method:** `PUT`
- **Path:** `/books/{id}` (for example `/books/42`)
- **Description:** Replaces the whole book record with the new version.
- **Success status:** `200 OK`
- **Example request body:**

```json
{
  "title": "Things Fall Apart",
  "author": "Chinua Achebe",
  "isbn": "9780385474542",
  "year": 1958,
  "available": false
}
```

### 5. Update part of a book

- **Method:** `PATCH`
- **Path:** `/books/{id}` (for example `/books/42`)
- **Description:** Changes only the fields that are sent, such as marking a book as borrowed.
- **Success status:** `200 OK`
- **Example request body:**

```json
{
  "available": false
}
```

### 6. Delete a book

- **Method:** `DELETE`
- **Path:** `/books/{id}` (for example `/books/42`)
- **Description:** Removes the book from the library.
- **Request body:** none
- **Success status:** `204 No Content`

### 7. List books by an author

- **Method:** `GET`
- **Path:** `/books?author=Chinua%20Achebe`
- **Description:** Returns only the books written by the author given in the `author` query parameter.
- **Request body:** none
- **Success status:** `200 OK`

## Error codes

### 400 Bad Request

- The request was invalid.
- **Example:** `POST /books` is sent with an empty `title`, or with no `author` at all, so the server cannot create the book.

### 404 Not Found

- The item or URL does not exist.
- **Example:** `GET /books/9999` is requested, but no book with id 9999 exists. The same happens with `PATCH /books/9999` or `DELETE /books/9999`.
