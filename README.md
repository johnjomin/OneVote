# OneVote
RESTful API for creating polls and casting votes with real time tracking. Built with TypeScript and NextJS

## Features
- Create polls with questions, multiple options and closing times
- One vote per user per poll (with duplication preventing added)
- Server Sent Events (SSE) for live result streaming
- Inmemory TTL cache for optimized result
- Optional result hiding until poll closes
- OpenAPI/Swagger documentation is pretty much included

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

## Note: 
Accessing the root URL ie http://localhost:3000 => will show a "Cannot GET /" error. 
I think this is normal for REST APIs that don't serve a homepage. Use http://localhost:3000/docs to get specific API endpoints 