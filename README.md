# OneVote
Little voting app API. You can create polls, vote once, and see results update in real time. 
It’s built with Node.js + TypeScript

## Setup Instructions

Just copy and paste these commands :) =>

```bash
# Clone and install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Run the app in dev mode (hot reload)
npm run start:dev
```

## Now open:
- API: http://localhost:3000
- Documentation: http://localhost:3000/docs

## API Documentation

### Create a Poll
```bash
curl -X POST http://localhost:3000/polls \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is your favorite programming language?",
    "options": ["JavaScript", "TypeScript", "Go", "Python"],
    "closesAt": "2030-12-31T23:59:59.000Z",
    "hideResultsUntilClose": false
  }'
```

### Get a Poll
```bash
curl http://localhost:3000/polls/{poll-id}
```

### Cast a Vote
```bash
curl -X POST http://localhost:3000/polls/{poll-id}/votes \
  -H "Content-Type: application/json" \
  -d '{
    "optionId": "{option-id}",
    "userUuid": "your-unique-user-id"
  }'
```

### See results
```bash
curl http://localhost:3000/polls/{poll-id}/results
```

### Watch results live
```bash
curl http://localhost:3000/polls/{poll-id}/stream
```

This opens a Server-Sent Events connection that pushes result updates whenever someone votes.

## Database in plain words

Keep it simple with three main tables:

- polls -> holds the question and settings
- poll_options -> the possible answers
- votes -> who voted for what

**Important bit:** you can’t vote twice on the same poll because the database won’t let the same user vote again. (nice try though :D ) ie (pollId, userUuid)

## How to stop double votes

Here's how to avoid double-votes and race conditions:

- Database has a unique rule: one user ID per poll ie (pollId, userUuid)
- Votes are saved inside a transaction (safe block).
- If someone tries to sneak in a second vote -> return 409 Conflict (“you already voted”).

**In plain English:** If two people with the same user ID try to vote at exactly the same time, the database will only let one vote through. 
The second person gets a "you already voted" message.

This approach is simple, fast, and reliable. For a small to medium voting app, it's perfect :)

## Caching

- Cache poll results for 10 seconds so the database doesn’t get hammered.
- Don’t worry: when a new vote comes in, refresh the cache right away ie RESULTS_CACHE_TTL_SECONDS
- Trade-off: if the server restarts, cache is empty until the first request — but that’s fine.

**Trade-off:** If you restart the server, cached results disappear. But they rebuild automatically on first request, so no big deal

## Architectural Decisions and Tradeoffs

## Why built it this way???
- NestJS -> makes APIs neat and organized.
- TypeORM -> easy way to save stuff in the database.
- SQLite -> just works, no setup. Perfect for demos.

### Error codes app use:
- 400 = bad input (you sent nonsense)
- 404 = poll or option not found
- 409 = you already voted
- 422 = poll is closed, too late to vote

## Design Patterns:
- Service Layer: Controllers stay thin, services handle business logic
- DTO Validation: Input gets validated at the API boundary with friendly error messages
- Global Error Handling: Consistent error responses across all endpoints
- Event-Driven Updates: Real-time features use RxJS observables

**Why??** Keep it simple, readable, and maintainable.


## Performance
### Good enough for now?:

- Small in-memory cache (10s)
- Database checks for double votes
- Transactions = safe writes

### If ever go “viral” -> thats a BIG IF:

- Switch SQLite -> PostgreSQL
- Use Redis for shared caching
- Spread load across multiple servers
- Add rate limits so no one spams votes

## bit of current bottlenecks?:
- Single SQLite file limits concurrent writes
- In-memory cache doesn't share across multiple servers
- SSE connections consume server memory

**But honestly:** For polls with < ie 10,000 total votes, the current setup will work great.

## Tests

```bash
# run test once
npm test

# keep running on file change
npm run test:watch

# Coverage
npm run test:cov
```


## Development Notes
**Environment variables:**
- PORT (default: 3000)
- DATABASE_PATH (default: ./onevote.sqlite)
- RESULTS_CACHE_TTL_SECONDS (default: 10)
- Docs live at /docs.


---

*Made with lot of coffee, code, and bit of dash of panic :D*