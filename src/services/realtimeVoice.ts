/**
 * Service to manage fetch calls and connection parameters for OpenAI Realtime API.
 */

export interface EphemeralSessionResponse {
  client_secret: {
    value: string;
    expires_at: number;
  };
}

/**
 * Fetches the ephemeral session token from the backend securely.
 */
export async function fetchEphemeralToken(voice: string = "alloy"): Promise<string> {
  const response = await fetch("/api/realtime/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ voice }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch ephemeral token: ${errorText || response.statusText}`);
  }

  const data: EphemeralSessionResponse = await response.json();
  if (!data?.client_secret?.value) {
    throw new Error("Invalid session token structure returned from backend");
  }

  return data.client_secret.value;
}
