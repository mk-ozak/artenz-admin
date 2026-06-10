import { google } from 'googleapis'

const HALL_LABEL = {
  ARTENZ_PLUS: 'ARTENZ PLUS',
  ARTENZ:      'ARTENZ',
  LUNA:        'LUNA',
  CATERING:    'CATERING',
}

function getCalendar() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })
  return google.calendar({ version: 'v3', auth })
}

function eventBody({ title, hall, date }) {
  return {
    summary:     title,
    description: `Sála: ${HALL_LABEL[hall] ?? hall}`,
    start:       { date },
    end:         { date },
  }
}

export default async function handler(req, res) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.GOOGLE_CALENDAR_ID) {
    return res.status(500).json({ error: 'Google Calendar not configured' })
  }

  const calendarId = process.env.GOOGLE_CALENDAR_ID

  try {
    const calendar = getCalendar()

    if (req.method === 'POST') {
      const { title, hall, date } = req.body
      const { data } = await calendar.events.insert({
        calendarId,
        requestBody: eventBody({ title, hall, date }),
      })
      return res.json({ eventId: data.id })
    }

    if (req.method === 'PATCH') {
      const { eventId, title, hall, date } = req.body
      await calendar.events.update({
        calendarId,
        eventId,
        requestBody: eventBody({ title, hall, date }),
      })
      return res.json({ ok: true })
    }

    if (req.method === 'DELETE') {
      const { eventId } = req.body
      if (eventId) {
        await calendar.events.delete({ calendarId, eventId })
      }
      return res.json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[calendar]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
