"use client";

import { useState, useEffect } from "react";
import {
  getBaseUrl,
  getApiUrl,
  createApiFetch,
  getEnvConfig,
} from "~/lib/api-utils";

export function ApiUrlExamples() {
  const [envConfig, setEnvConfig] = useState<any>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  useEffect(() => {
    // Get environment configuration
    setEnvConfig(getEnvConfig());
  }, []);

  const testApiCall = async (path: string, method: string = "GET") => {
    try {
      const url = getApiUrl(path);
      console.log(`Making ${method} request to: ${url}`);

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();
      setTestResults((prev) => ({
        ...prev,
        [path]: { success: response.ok, data: result, url },
      }));
    } catch (error) {
      setTestResults((prev) => ({
        ...prev,
        [path]: {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          url: getApiUrl(path),
        },
      }));
    }
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">API URL Utilities Examples</h1>

      {/* Environment Information */}
      <div className="rounded-lg bg-gray-100 p-4">
        <h2 className="mb-2 text-lg font-semibold">
          Environment Configuration
        </h2>
        {envConfig && (
          <pre className="text-sm">{JSON.stringify(envConfig, null, 2)}</pre>
        )}
      </div>

      {/* URL Generation Examples */}
      <div className="rounded-lg bg-blue-50 p-4">
        <h2 className="mb-2 text-lg font-semibold">URL Generation Examples</h2>
        <div className="space-y-2 text-sm">
          <div>
            <strong>Base URL:</strong> <code>{getBaseUrl()}</code>
          </div>
          <div>
            <strong>API URL (/api/espn/nba/teams):</strong>{" "}
            <code>{getApiUrl("/api/espn/nba/teams")}</code>
          </div>
          <div>
            <strong>API URL (api/espn/nba/team/1/roster):</strong>{" "}
            <code>{getApiUrl("api/espn/nba/team/1/roster")}</code>
          </div>
        </div>
      </div>

      {/* Test API Calls */}
      <div className="rounded-lg bg-green-50 p-4">
        <h2 className="mb-2 text-lg font-semibold">Test API Calls</h2>
        <div className="space-y-2">
          <button
            onClick={() => testApiCall("/api/espn/nba/teams")}
            className="mr-2 rounded bg-blue-500 px-4 py-2 text-white"
          >
            Test NBA Teams API
          </button>
          <button
            onClick={() => testApiCall("/api/espn/nba/team/1/roster")}
            className="mr-2 rounded bg-green-500 px-4 py-2 text-white"
          >
            Test Team Roster API
          </button>
        </div>
      </div>

      {/* Test Results */}
      {Object.keys(testResults).length > 0 && (
        <div className="rounded-lg bg-gray-50 p-4">
          <h2 className="mb-2 text-lg font-semibold">Test Results</h2>
          {Object.entries(testResults).map(([path, result]) => (
            <div key={path} className="mb-4 rounded border p-3">
              <div className="font-medium">{path}</div>
              <div className="text-sm text-gray-600">URL: {result.url}</div>
              <div
                className={`text-sm ${result.success ? "text-green-600" : "text-red-600"}`}
              >
                Status: {result.success ? "Success" : "Failed"}
              </div>
              {result.error && (
                <div className="text-sm text-red-600">
                  Error: {result.error}
                </div>
              )}
              {result.data && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-medium">
                    Show Response
                  </summary>
                  <pre className="mt-1 max-h-32 overflow-auto rounded bg-white p-2 text-xs">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Usage Examples */}
      <div className="rounded-lg bg-yellow-50 p-4">
        <h2 className="mb-2 text-lg font-semibold">Usage Examples in Code</h2>
        <div className="space-y-4 text-sm">
          <div>
            <strong>1. Client-side component:</strong>
            <pre className="mt-1 overflow-auto rounded bg-white p-3">
              {`import { getApiUrl } from "~/lib/api-utils";

// In a React component
const fetchTeams = async () => {
  const response = await fetch(getApiUrl('/api/espn/nba/teams'));
  return response.json();
};`}
            </pre>
          </div>

          <div>
            <strong>2. Server-side API route:</strong>
            <pre className="mt-1 overflow-auto rounded bg-white p-3">
              {`import { getApiUrl } from "~/lib/api-utils";

// In an API route (pages/api or app/api)
export async function GET() {
  const response = await fetch(getApiUrl('/api/espn/nba/teams'));
  const data = await response.json();
  return Response.json(data);
}`}
            </pre>
          </div>

          <div>
            <strong>3. Server component (page.tsx):</strong>
            <pre className="mt-1 overflow-auto rounded bg-white p-3">
              {`import { getApiUrl } from "~/lib/api-utils";

// In a server component
async function getData() {
  const response = await fetch(getApiUrl('/api/espn/nba/teams'), {
    cache: 'force-cache',
    next: { revalidate: 3600 }
  });
  return response.json();
}`}
            </pre>
          </div>

          <div>
            <strong>4. Using the createApiFetch utility:</strong>
            <pre className="mt-1 overflow-auto rounded bg-white p-3">
              {`import { createApiFetch } from "~/lib/api-utils";

// Create a configured fetch function
const apiFetch = createApiFetch();

// Use it like regular fetch, but with automatic URL resolution
const response = await apiFetch('/api/espn/nba/teams');`}
            </pre>
          </div>
        </div>
      </div>

      {/* Environment Variables Guide */}
      <div className="rounded-lg bg-purple-50 p-4">
        <h2 className="mb-2 text-lg font-semibold">
          Environment Variables Setup
        </h2>
        <div className="space-y-2 text-sm">
          <p>
            Create a <code>.env.local</code> file with:
          </p>
          <pre className="rounded bg-white p-3">
            {`# For local development (optional, will default to http://localhost:3000)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# For production (replace with your actual domain)
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Vercel automatically sets this in deployments
# VERCEL_URL=your-app-name.vercel.app`}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default ApiUrlExamples;
