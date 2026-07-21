/** OpenAPI 3.1 spec for the public REST API (served at /api/v1/openapi.json). */
export const OPENAPI_SPEC = {
  openapi: "3.1.0",
  info: {
    title: "Gwave Public API",
    version: "1.0.0",
    description:
      "Read-only REST API. Authenticate every request with `Authorization: Bearer <api key>`. Keys are created in the Developer dashboard (/dev) with per-key scopes and a per-minute rate limit.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/posts": {
      get: {
        summary: "Recent public posts",
        description: "Scope: read:posts",
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", maximum: 100, default: 20 },
          },
        ],
        responses: { "200": { description: "List of public posts" } },
      },
    },
    "/strains": {
      get: {
        summary: "Cannabis strain database",
        description: "Scope: read:knowledge",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          {
            name: "type",
            in: "query",
            schema: { type: "string", enum: ["indica", "sativa", "hybrid"] },
          },
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "List of strains" } },
      },
    },
    "/minerals": {
      get: {
        summary: "Minerals & metals database",
        description: "Scope: read:knowledge",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "List of minerals" } },
      },
    },
    "/sensors": {
      get: {
        summary: "Your devices' recent sensor readings",
        description: "Scope: read:sensors. Returns readings from devices owned by the key's owner.",
        parameters: [
          { name: "device", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "metric", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "Sensor readings" } },
      },
    },
    "/pos/products": {
      get: {
        summary: "Your store's products with stock",
        description: "Scope: read:pos",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "Products" },
          "404": { description: "The key owner has no store" },
        },
      },
    },
  },
} as const;
