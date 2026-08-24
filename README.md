# URL Monitoring Service

A REST API for monitoring websites and tracking their availability, response time, uptime, checks, and incidents.

## Features

- Create, update, list, and delete URL monitors
- Monitor HTTP and HTTPS URLs
- Configurable monitoring intervals
- Configurable expected HTTP status codes
- Automatic URL health checks
- Check history
- Incident creation when a monitor fails
- Prevent duplicate open incidents
- Automatic incident recovery
- Public monitoring status
- Uptime statistics
- Average latency
- P95 latency
- Cursor-based pagination
- CSV export of check history
- Request validation with Zod
- PostgreSQL database
- Background monitoring scheduler
- Automated tests
- Security tests
- OpenAPI documentation

## Tech Stack

- Node.js
- Express.js
- PostgreSQL
- Zod
- pg
- Nodemon
- Node.js Test Runner
- OpenAPI

## Requirements

- Node.js
- PostgreSQL
- npm

## Installation

Clone the project and enter the directory:

```bash
git clone <repository-url>
cd url-monitoring-service
