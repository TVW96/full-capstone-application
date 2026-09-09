# syntax=docker/dockerfile:1
FROM node:22-alpine AS dependencies

WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build-runner
COPY . .

ARG NEXT_PUBLIC_BACKEND_API_URL=/api
ENV NEXT_PUBLIC_BACKEND_API_URL=${NEXT_PUBLIC_BACKEND_API_URL}
CMD ["npm", "run", "build"]

FROM build-runner AS build
RUN npm run build

FROM nginx:1.27-alpine AS final
COPY --from=build /usr/src/app/out /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
