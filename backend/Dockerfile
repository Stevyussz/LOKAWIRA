FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV BACKEND_HOST=0.0.0.0

# Install production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy backend service and shared business logic
COPY backend ./backend
COPY src/lib ./src/lib
COPY src/types ./src/types
COPY tsconfig.json ./

EXPOSE 4000

CMD ["npx", "tsx", "--tsconfig", "backend/tsconfig.json", "backend/src/server.ts"]
