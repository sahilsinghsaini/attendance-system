const API =
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000/api/v1';

function getHeaders(options: RequestInit, token?: string) {
  return {
    'Content-Type': 'application/json',
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
    ...(options.headers || {}),
  };
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refresh_token');

  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await fetch(
    `${API}/auth/refresh?refresh_token=${encodeURIComponent(refreshToken)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('role');

    throw new Error('Refresh token expired');
  }

  const data = await response.json();

  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('refresh_token', data.refresh_token);

  return data.access_token;
}

export async function api(
  path: string,
  options: RequestInit = {}
) {
  let token = localStorage.getItem('access_token');

  let response = await fetch(API + path, {
    ...options,
    headers: getHeaders(options, token || undefined),
  });

  /*
   * If the access token expired, refresh it once
   * and retry the original request.
   */
  if (
    response.status === 401 &&
    !path.startsWith('/auth/refresh') &&
    !path.startsWith('/auth/login')
  ) {
    try {
      token = await refreshAccessToken();

      response = await fetch(API + path, {
        ...options,
      headers: getHeaders(options, token ?? undefined),
      });
    } catch {
      throw new Error('Authentication expired. Please sign in again.');
    }
  }

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.status === 204
    ? null
    : response.json();
}