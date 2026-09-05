# syntax=docker/dockerfile:1
FROM node:22-alpine AS build

WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_BACKEND_API_URL=${NEXT_PUBLIC_BACKEND_API_URL}
RUN npm run build

FROM nginx:1.27-alpine AS final
COPY --from=build /usr/src/app/out /usr/share/nginx/html
EXPOSE 80