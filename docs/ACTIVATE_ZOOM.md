# Video calls on the platform

**This is done. There is nothing for you to set up.**

Zoom's Server-to-Server OAuth setup was genuinely complex: an app, three secrets, scope
selection, and every staff member needing a matching Zoom seat with a matching email. That is
a lot of moving parts before the first call, and every one of them is something that can be
wrong six months later when nobody remembers configuring it.

We are using **Jitsi Meet** instead. It needs no account, no API key, no credentials, and no
per-staff seat.

---

## How it works now

A staff member asks Penny to book a call. Penny creates the appointment and emails the person
an invitation with a join link that looks like:

    https://meet.jit.si/ayp-e9e7182562e046fbbaa415ab65e8e791

They click it at the time. It opens in the browser. Nothing to download, no account to
create, works on a phone.

**Every appointment gets its own room.** That was the real problem with the personal-link
fallback: everyone booking with the same staff member got the same URL, so two clients could
in principle land in the same call. Now the room name is derived from the appointment id, so
it is different every time and unguessable — a predictable name like `ayp-tampa-tuesday` is a
room a stranger can walk into, and these calls discuss a client's money.

---

## What it does and does not do

**Does:**
- Video and audio, in the browser, on desktop and mobile.
- Screen sharing, chat, and a dial-in option.
- A separate room per appointment.
- Works for a client who has never used it before and will not install anything.

**Does not:**
- **No recording.** If you want calls recorded, that is a separate decision with consent
  implications in several states, and it needs discussing before it is switched on rather
  than after.
- **No waiting room.** Anyone with the link can join. The link is unguessable and only goes
  to the person invited, but it is not a locked door. If a call is genuinely sensitive, the
  host can lock the room from inside the meeting.
- **Not your brand.** The page says Jitsi Meet, not Access Your Place.

---

## If you later decide you want Zoom anyway

The reasons would be recording, a waiting room, or brand. If any of those become important,
the setup is: a Server-to-Server OAuth app at `marketplace.zoom.us`, three secrets
(`ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`) added to Supabase Edge Function
secrets, scopes `meeting:write:admin`, `meeting:read:admin` and `user:read:admin`, and every
Success Team member holding a Zoom seat under the same email they use here.

Say the word and I will wire it as an upgrade, keeping the current rooms as the fallback so
nothing breaks while it is being set up.

---

## What this changes for the team

There is now no situation where a Success Team member needs to give a client a phone number.
That is in the Terms of Service as a compliance and record-keeping requirement, and it
protects the team as much as the record:

- Every conversation with a client happens on the platform — message, video, or audio.
- Staff do not give out personal numbers and are not permitted to work through them.
- **Landlords are the exception.** Apartment communities and private owners will not always
  get on a video call, and we are not losing a property over it. Staff speak to landlords
  however that landlord prefers, and record the substance here afterwards.
