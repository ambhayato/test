import { loginRequest } from "./authConfig";

async function getAccessToken(msalInstance) {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) throw new Error("No accounts found");

  const response = await msalInstance.acquireTokenSilent({
    ...loginRequest,
    account: accounts[0],
  });
  return response.accessToken;
}

async function graphFetch(msalInstance, url) {
  const token = await getAccessToken(msalInstance);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Graph API error: ${response.status}`);
  return response.json();
}

// Get all users in the tenant (domain members)
export async function getDomainUsers(msalInstance) {
  const data = await graphFetch(
    msalInstance,
    "https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,jobTitle,department&$top=100"
  );
  return data.value.filter((u) => u.mail);
}

// Get calendar events for a specific user within a date range
export async function getUserCalendarEvents(msalInstance, userId, startDate, endDate) {
  const start = startDate.toISOString();
  const end = endDate.toISOString();

  // Use /me/calendar for current user, /users/{id}/calendar for others
  const isSelf = userId === "me";
  const base = isSelf
    ? "https://graph.microsoft.com/v1.0/me"
    : `https://graph.microsoft.com/v1.0/users/${userId}`;

  const url =
    `${base}/calendarView?startDateTime=${start}&endDateTime=${end}` +
    `&$select=id,subject,start,end,isAllDay,showAs,organizer` +
    `&$orderby=start/dateTime&$top=100`;

  try {
    const data = await graphFetch(msalInstance, url);
    return data.value;
  } catch {
    // Return empty if no permission to read this user's calendar
    return [];
  }
}

// Get calendar events for multiple users in parallel
export async function getTeamCalendarEvents(msalInstance, userIds, startDate, endDate) {
  const results = await Promise.all(
    userIds.map(async (userId) => {
      const events = await getUserCalendarEvents(msalInstance, userId, startDate, endDate);
      return { userId, events };
    })
  );
  return results;
}
