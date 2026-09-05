# Set node version to use for the build. This can be overridden at build time with the --build-arg flag.
ARG NODE_VERSION=26.5.1

################################################
# Stage: Development
################################################
# Use node image for base image for all stages.
FROM node:${NODE_VERSION}-alpine AS base
# Set working directory for all build stages.
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm install -g npm@latest
COPY . .
EXPOSE 3001
# Run the application as a non-root user.
CMD ["npm", "run", "start:prod"]
# Health check to ensure the application is running.
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/


################################################
# Stage: Production
################################################

# Create a stage from development for installing production dependencies.
FROM base AS deps

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.npm to speed up subsequent builds.
# Leverage bind mounts to package.json and package-lock.json to avoid having to copy them
# into this layer.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

################################################
# Stage: Build
################################################
FROM deps AS build

# Download additional development dependencies before building, as some projects require
# "devDependencies" to be installed to build. If you don't need this, remove this step.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci

# Copy the rest of the source files into the image.
COPY . .
# Run the build script.
RUN npm run build

################################################
# Stage: Final
################################################
FROM base AS final

# Use production node environment by default.
ENV NODE_ENV=production

# Run the application as a non-root user.
USER node

# Copy package.json so that package manager commands can be used.
COPY package.json .

# Copy the production dependencies from the deps stage and also
# the built application from the build stage into the image.
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/./ ././


# Expose the port that the application listens on.
EXPOSE 3001

# Run the application.
CMD ["npm", "run", "start:prod"]
