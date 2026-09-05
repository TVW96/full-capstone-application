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
