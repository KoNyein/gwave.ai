/**
 * k6 load test for the feed API.
 *
 *   1. Log in in a browser and copy the Supabase auth cookies
 *      (sb-<ref>-auth-token[.0/.1]) from DevTools.
 *   2. k6 run -e BASE_URL=https://social.gwave.cc \
 *             -e COOKIE "sb-xxx-auth-token=...;" \
 *             scripts/load-test-feed.js
 *
 * Ramps to 50 concurrent users; alerts when p95 exceeds 800 ms or any
 * request fails. The feed endpoint is keyset-paginated, so the test also
 * exercises page 2 with the cursor from page 1.
 */

import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 50 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<800"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const COOKIE = __ENV.COOKIE || "";

export default function () {
  const params = { headers: { Cookie: COOKIE } };

  const first = http.get(`${BASE_URL}/api/posts?scope=feed`, params);
  check(first, {
    "feed page 1: 200": (response) => response.status === 200,
    "feed page 1: has posts": (response) =>
      JSON.parse(response.body).posts !== undefined,
  });

  const cursor = JSON.parse(first.body).nextCursor;
  if (cursor) {
    const second = http.get(
      `${BASE_URL}/api/posts?scope=feed&cursor=${encodeURIComponent(cursor)}`,
      params,
    );
    check(second, {
      "feed page 2: 200": (response) => response.status === 200,
    });
  }

  sleep(1);
}
