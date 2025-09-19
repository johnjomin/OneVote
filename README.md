# OneVote
TypeScript RESTful API for creating polls and casting votes with real time tracking. Built with TypeScript and NextJS

## Features

- Create polls with questions, multiple options and closing times
- One vote per user per poll (with duplication preventing added)
- Server Sent Events (SSE) for live result streaming
- Inmemory TTL cache for optimized result computation
- Optional result hiding until poll closes
- OpenAPI/Swagger documentation included

## Quick Start
### Pre requiste (ie things you need before setting up)
- Node.js 18+
- npm or yarn

### Installation & Setup
```bash
# Clone and install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Start development server
npm run start:dev
```

The API will be available at:
- **API**: http://localhost:3000
- **Documentation**: http://localhost:3000/docs