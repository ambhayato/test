require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory EWS config store (per-session config stored server-side)
let ewsConfig = {
  host: process.env.EWS_HOST || '',
  username: process.env.EWS_USERNAME || '',
  password: process.env.EWS_PASSWORD || '',
  auth: process.env.EWS_AUTH || 'ntlm'
};

function createEWSClient() {
  const NodeEWS = require('node-ews');
  return new NodeEWS({
    username: ewsConfig.username,
    password: ewsConfig.password,
    host: ewsConfig.host,
    auth: ewsConfig.auth
  });
}

function normalizeItems(items) {
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

function mapCalendarItem(item) {
  return {
    id: item.ItemId?.attributes?.Id,
    changeKey: item.ItemId?.attributes?.ChangeKey,
    title: item.Subject || '(タイトルなし)',
    start: item.Start,
    end: item.End,
    location: item.Location || '',
    body: typeof item.Body === 'object' ? item.Body?._ : item.Body || '',
    isRecurring: item.IsRecurring === 'true',
    organizer: item.Organizer?.Mailbox?.Name || '',
    organizerEmail: item.Organizer?.Mailbox?.EmailAddress || '',
    isMeeting: item.IsMeeting === 'true',
    status: item.LegacyFreeBusyStatus || 'Busy'
  };
}

// ─── Config endpoints ─────────────────────────────────────────────────────────

app.get('/api/config', (req, res) => {
  res.json({
    host: ewsConfig.host,
    username: ewsConfig.username,
    auth: ewsConfig.auth,
    configured: !!(ewsConfig.host && ewsConfig.username && ewsConfig.password)
  });
});

app.post('/api/config', (req, res) => {
  const { host, username, password, auth } = req.body;
  if (!host || !username || !password) {
    return res.status(400).json({ error: 'host, username, password は必須です' });
  }
  ewsConfig = { host, username, password, auth: auth || 'ntlm' };
  res.json({ success: true });
});

app.post('/api/config/test', async (req, res) => {
  try {
    const ews = createEWSClient();
    const ewsArgs = {
      attributes: { Traversal: 'Shallow' },
      ItemShape: { BaseShape: 'IdOnly' },
      CalendarView: {
        attributes: {
          MaxReturnsTotal: '1',
          StartDate: new Date().toISOString(),
          EndDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      },
      ParentFolderIds: {
        DistinguishedFolderId: { attributes: { Id: 'calendar' } }
      }
    };
    await ews.run('FindItem', ewsArgs);
    res.json({ success: true, message: '接続成功' });
  } catch (err) {
    res.status(400).json({ error: '接続失敗: ' + err.message });
  }
});

// ─── Calendar events ──────────────────────────────────────────────────────────

app.get('/api/events', async (req, res) => {
  try {
    const { start, end, email } = req.query;
    const ews = createEWSClient();

    const folderIdAttr = email
      ? { attributes: { Id: 'calendar' }, Mailbox: { EmailAddress: email } }
      : { attributes: { Id: 'calendar' } };

    const ewsArgs = {
      attributes: { Traversal: 'Shallow' },
      ItemShape: {
        BaseShape: 'AllProperties'
      },
      CalendarView: {
        attributes: {
          MaxReturnsTotal: '500',
          StartDate: start || new Date().toISOString(),
          EndDate: end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      ParentFolderIds: {
        DistinguishedFolderId: folderIdAttr
      }
    };

    const result = await ews.run('FindItem', ewsArgs);
    const rawItems =
      result?.ResponseMessages?.FindItemResponseMessage?.RootFolder?.Items
        ?.CalendarItem || [];

    const events = normalizeItems(rawItems).filter(Boolean).map(mapCalendarItem);
    res.json(events);
  } catch (err) {
    console.error('GET /api/events error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    const { title, start, end, location, body, attendees, allDay } = req.body;
    const ews = createEWSClient();

    const calItem = {
      Subject: title,
      Start: start,
      End: end,
      IsAllDayEvent: allDay ? 'true' : 'false'
    };

    if (location) calItem.Location = location;
    if (body) calItem.Body = { attributes: { BodyType: 'Text' }, _: body };
    if (attendees && attendees.length > 0) {
      calItem.RequiredAttendees = {
        Attendee: attendees.map(email => ({ Mailbox: { EmailAddress: email } }))
      };
    }

    const ewsArgs = {
      attributes: { SendMeetingInvitations: attendees?.length > 0 ? 'SendToAllAndSaveCopy' : 'SendToNone' },
      SavedItemFolderId: {
        DistinguishedFolderId: { attributes: { Id: 'calendar' } }
      },
      Items: { CalendarItem: calItem }
    };

    const result = await ews.run('CreateItem', ewsArgs);
    res.json({ success: true, result });
  } catch (err) {
    console.error('POST /api/events error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { changeKey, title, start, end, location, body } = req.body;
    const ews = createEWSClient();

    const setFields = [
      {
        FieldURI: { attributes: { FieldURI: 'item:Subject' } },
        CalendarItem: { Subject: title }
      },
      {
        FieldURI: { attributes: { FieldURI: 'calendar:Start' } },
        CalendarItem: { Start: start }
      },
      {
        FieldURI: { attributes: { FieldURI: 'calendar:End' } },
        CalendarItem: { End: end }
      }
    ];

    if (location !== undefined) {
      setFields.push({
        FieldURI: { attributes: { FieldURI: 'calendar:Location' } },
        CalendarItem: { Location: location }
      });
    }

    if (body !== undefined) {
      setFields.push({
        FieldURI: { attributes: { FieldURI: 'item:Body' } },
        CalendarItem: { Body: { attributes: { BodyType: 'Text' }, _: body } }
      });
    }

    const ewsArgs = {
      attributes: {
        ConflictResolution: 'AlwaysOverwrite',
        SendMeetingInvitationsOrCancellations: 'SendToAllAndSaveCopy'
      },
      ItemChanges: {
        ItemChange: {
          ItemId: { attributes: { Id: id, ChangeKey: changeKey } },
          Updates: { SetItemField: setFields }
        }
      }
    };

    const result = await ews.run('UpdateItem', ewsArgs);
    res.json({ success: true, result });
  } catch (err) {
    console.error('PUT /api/events/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { changeKey } = req.query;
    const ews = createEWSClient();

    const ewsArgs = {
      attributes: {
        DeleteType: 'MoveToDeletedItems',
        SendMeetingCancellations: 'SendToAllAndSaveCopy'
      },
      ItemIds: {
        ItemId: { attributes: { Id: id, ChangeKey: changeKey || '' } }
      }
    };

    await ews.run('DeleteItem', ewsArgs);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/events/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Search ───────────────────────────────────────────────────────────────────

app.get('/api/events/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const ews = createEWSClient();

    const ewsArgs = {
      attributes: { Traversal: 'Shallow' },
      ItemShape: { BaseShape: 'AllProperties' },
      Restriction: {
        Or: {
          Contains: [
            {
              attributes: { ContainmentMode: 'Substring', ContainmentComparison: 'IgnoreCase' },
              FieldURI: { attributes: { FieldURI: 'item:Subject' } },
              Constant: { attributes: { Value: q } }
            },
            {
              attributes: { ContainmentMode: 'Substring', ContainmentComparison: 'IgnoreCase' },
              FieldURI: { attributes: { FieldURI: 'calendar:Location' } },
              Constant: { attributes: { Value: q } }
            }
          ]
        }
      },
      ParentFolderIds: {
        DistinguishedFolderId: { attributes: { Id: 'calendar' } }
      }
    };

    const result = await ews.run('FindItem', ewsArgs);
    const rawItems =
      result?.ResponseMessages?.FindItemResponseMessage?.RootFolder?.Items
        ?.CalendarItem || [];

    const events = normalizeItems(rawItems).filter(Boolean).map(mapCalendarItem);
    res.json(events);
  } catch (err) {
    console.error('GET /api/events/search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Multi-user availability ──────────────────────────────────────────────────

app.post('/api/availability', async (req, res) => {
  try {
    const { emails, start, end } = req.body;
    if (!emails || emails.length === 0) {
      return res.status(400).json({ error: 'emails は必須です' });
    }
    const ews = createEWSClient();

    const ewsArgs = {
      MailboxDataArray: {
        MailboxData: emails.map(email => ({
          Email: { Address: email },
          AttendeeType: 'Required',
          ExcludeConflicts: 'false'
        }))
      },
      FreeBusyViewOptions: {
        TimeWindow: {
          StartTime: start,
          EndTime: end
        },
        RequestedView: 'DetailedMerged',
        MergedFreeBusyIntervalInMinutes: '30'
      }
    };

    const result = await ews.run('GetUserAvailability', ewsArgs);
    res.json(result);
  } catch (err) {
    console.error('POST /api/availability error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Other users' calendar events ─────────────────────────────────────────────

app.get('/api/users/:email/events', async (req, res) => {
  const { email } = req.params;
  req.query.email = email;
  // Delegate to /api/events handler
  try {
    const { start, end } = req.query;
    const ews = createEWSClient();

    const ewsArgs = {
      attributes: { Traversal: 'Shallow' },
      ItemShape: { BaseShape: 'AllProperties' },
      CalendarView: {
        attributes: {
          MaxReturnsTotal: '500',
          StartDate: start || new Date().toISOString(),
          EndDate: end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      ParentFolderIds: {
        DistinguishedFolderId: {
          attributes: { Id: 'calendar' },
          Mailbox: { EmailAddress: email }
        }
      }
    };

    const result = await ews.run('FindItem', ewsArgs);
    const rawItems =
      result?.ResponseMessages?.FindItemResponseMessage?.RootFolder?.Items
        ?.CalendarItem || [];

    const events = normalizeItems(rawItems).filter(Boolean).map(mapCalendarItem);
    res.json(events);
  } catch (err) {
    console.error(`GET /api/users/${email}/events error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Outlook Calendar App listening on http://localhost:${PORT}`);
  if (!ewsConfig.host) {
    console.log('EWS設定が未完了です。ブラウザで設定画面から接続情報を入力してください。');
  }
});
