import type { NextConfig } from "next";

const repository = process.env.GITHUB_REPOSITORY?.split("/") ?? [];
const repositoryOwner = repository[0] ?? "";
const repositoryName = repository[1] ?? "";
const isUserOrOrganizationSite =
  repositoryName.toLowerCase() ===
  `${repositoryOwner.toLowerCase()}.github.io`;
const pagesBasePath =
  process.env.PAGES_BASE_PATH ??
  (process.env.GITHUB_ACTIONS === "true" &&
  repositoryName &&
  !isUserOrOrganizationSite
    ? `/${repositoryName}`
    : "");

function validateNetlifyBackendUrl(): void {
  if (process.env.NETLIFY !== "true") return;

  const value = process.env.NEXT_PUBLIC_BACKEND_API_URL?.trim();
  if (!value) {
    throw new Error(
      "NEXT_PUBLIC_BACKEND_API_URL is required for Netlify builds.",
    );
  }

  if (value === "/api" && process.env.UNIFIED_APP_URL?.trim()) return;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_BACKEND_API_URL must be a valid absolute URL.",
    );
  }

  if (url.protocol !== "https:") {
    throw new Error(
      "NEXT_PUBLIC_BACKEND_API_URL must use HTTPS for a Netlify deployment.",
    );
  }

  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    throw new Error(
      "NEXT_PUBLIC_BACKEND_API_URL cannot point to localhost in a Netlify build.",
    );
  }
}

validateNetlifyBackendUrl();

const nextConfig: NextConfig = {
  output: "export",
  allowedDevOrigins: ["127.0.0.1"],
  trailingSlash: true,
  basePath: pagesBasePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: pagesBasePath,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
