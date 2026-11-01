import { Router, Request, Response } from 'express';
import { getAuthenticatedAccountFromToken } from '../authIdentity';
import { isRaceParticipant, recordRaceDnf } from '../raceSessions';

const router = Router();

// Called by navigator.sendBeacon on tab close. Beacon requests cannot add
// Authorization headers, so the short-lived access token is sent in JSON.
// DNF state is bound to the authenticated account and an active server room;
// rating and history are settled once from the race-result route.
router.post('/dnf', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['token', 'raceId'].includes(key))) {
      return res.status(400).json({ error: 'Invalid race abandonment request.' });
    }
    const { token, raceId } = body;
    if (
      typeof token !== 'string' || token.length > 8192 ||
      typeof raceId !== 'string' || !/^[0-9a-f-]{36}$/i.test(raceId)
    ) {
      return res.status(400).json({ error: 'Invalid race abandonment request.' });
    }

    const account = await getAuthenticatedAccountFromToken(token);
    if (!account) return res.status(401).json({ error: 'Invalid or expired session.' });
    if (!isRaceParticipant(raceId, account.id)) {
      return res.status(403).json({ error: 'This account did not participate in that race.' });
    }

    const changed = recordRaceDnf(raceId, account.id);
    return res.json({ success: true, duplicate: !changed });
  } catch {
    return res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
