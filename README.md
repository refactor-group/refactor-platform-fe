# Refactor Coaching & Mentoring Platform

## Frontend (currently web browser-only)

![377960688-0b5292b0-6ec7-4774-984e-8e99e503d26c](https://github.com/user-attachments/assets/5dcdee09-802e-4b25-aa58-757d607ce7bc)
A preview of the main coaching session page (rapidly evolving)

## Intro

A web frontend built on Next.js that provides a web API for various client applications (e.g. a web frontend) that facilitate the coaching and mentoring of software engineers.

The platform itself is useful for professional independent coaches, informal mentors and engineering leaders who work with individual software engineers and/or teams by providing a single application that facilitates and enhances your coaching practice.

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

### Setting Local Environment Variables

When running locally on a development machine you can manually set the application's configuration through a `.env` file at the root of the source tree:

```env
NEXT_PUBLIC_BACKEND_SERVICE_PROTOCOL="http"
NEXT_PUBLIC_BACKEND_SERVICE_PORT=4000
NEXT_PUBLIC_BACKEND_SERVICE_HOST="localhost"
NEXT_PUBLIC_BACKEND_API_VERSION="1.0.0-beta1"

# TIPTAP_APP_ID originates from your TipTap Cloud Dashboard
NEXT_PUBLIC_TIPTAP_APP_ID="<TIPTAP_APP_ID>"

FRONTEND_SERVICE_INTERFACE=0.0.0.0
FRONTEND_SERVICE_PORT=3000
```

**Note** that these variables get set and passed by docker-compose in the backend's `.env` file and _do not_ need to be set here in this case.

### Running the Development Server

```bash
npm run dev
```

### Logging Into the Application

Open [http://localhost:3000](http://localhost:3000) with your browser to log in to the platform.

#### For Working with and Running the Application in Docker, navigate to the [Container-README](./docs/runbooks/Container-README.md)
