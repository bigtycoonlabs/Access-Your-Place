# Wiring Zoom into the platform

**What you get when this is done:** Penny creates a real, unique Zoom meeting for every
appointment and emails the join link to the client and to the staff member. Nobody trades a
phone number, and every call has its own room rather than everyone sharing one.

**What works right now, before you do any of this:** staff can save their own personal Zoom
link in Settings, and Penny will send that with an invitation. It works, and you can use it
today. What it does not do is give each call its own room — everyone booking with the same
staff member gets the same link, so two clients could in principle land in the same meeting.
That is the reason to do the setup below.

Four steps. All of it is in a browser except step 3, which is two values pasted into
Supabase.

---

## Step 1 — Create the Zoom app

You need a **Server-to-Server OAuth** app. Not a "General" app: that kind asks each user to
sign in, and Penny has nobody to ask.

1. Go to `marketplace.zoom.us` and sign in with the Zoom account that owns the business
   licence.
2. Top right, **Develop** → **Build App**.
3. Choose **Server-to-Server OAuth**. Name it `Access Your Place`.
4. On the **App Credentials** page you will see three values. Copy all three somewhere safe
   for a moment:
   - **Account ID**
   - **Client ID**
   - **Client Secret**
5. **Information** tab: fill in the company name, your name and an email. Zoom will not let
   you activate without these.
6. **Scopes** tab → **Add Scopes**. Add exactly these:
   - `meeting:write:admin` — create meetings
   - `meeting:read:admin` — read them back
   - `user:read:admin` — find the staff member's Zoom user by email

   Do not add more than you need. If this credential ever leaks, the damage is bounded by
   what you granted.
7. **Activation** tab → **Activate your app**.

---

## Step 2 — Make sure each staff member has a Zoom user

A meeting is created *on behalf of* a Zoom user, so every Success Team member who books
calls needs a seat on your Zoom account.

1. Go to `zoom.us/account/user`.
2. Confirm each Success Team member is listed, using **the same email address they use to
   sign in to Access Your Place**. That match is how the platform finds them.
3. If somebody is missing, **Add Users** and invite them. They must accept before their
   first meeting can be created.

**If the emails do not match**, meeting creation for that person will fail. It will say so
rather than silently booking under somebody else — but it is easier to get right now.

---

## Step 3 — Put the credentials into Supabase

1. `supabase.com/dashboard` → the **Access Your Place** project.
2. **Edge Functions** → **Secrets**.
3. Add three secrets, names exactly as written:

   | Name | Value |
   |---|---|
   | `ZOOM_ACCOUNT_ID` | Account ID from step 1 |
   | `ZOOM_CLIENT_ID` | Client ID from step 1 |
   | `ZOOM_CLIENT_SECRET` | Client Secret from step 1 |

4. Save. Nothing needs redeploying — edge functions read secrets at request time.

**Treat the client secret like a password.** Anyone holding all three can create meetings on
your account. If it is ever pasted somewhere it should not be, regenerate it on the App
Credentials page and update the secret here.

---

## Step 4 — Check it, in a way that cannot lie to you

Ask Penny, on the staff desk:

> Book a Zoom call with [a client] tomorrow at 2pm about their Tampa unit.

**If Zoom is wired**, the invitation carries a link like `https://zoom.us/j/` followed by a
long number that is different every time. That is a real meeting.

**If it is not wired**, you get the staff member's saved personal link instead, and Penny
says so rather than pretending. If the staff member has no saved link either, she refuses
outright:

> "[Name] has no Zoom link saved yet, so this appointment would go out with no way to join."

That refusal is deliberate. Emailing a client an appointment they cannot join is worse than
telling the staff member to fix their settings first.

---

## What this changes about how the team works

Once this is on, there is no situation where a Success Team member needs to give a client a
phone number. That is now in the Terms of Service as a compliance and record-keeping
requirement, and it protects the team as much as the record:

- Every conversation with a client happens on the platform — message, video, or audio.
- Staff do not give out personal numbers and are not permitted to work through them.
- **Landlords are the exception.** Apartment communities and private owners will not always
  get on a video call, and we are not losing a property over it. Staff speak to landlords
  however that landlord prefers, and record the substance here afterwards.

---

## If something does not work

**"Invalid client" or 401 from Zoom** — the three secrets do not match the app, or the app
was never activated. Re-check step 1.7.

**"User does not exist"** — that staff member's Access Your Place email does not match a
Zoom user. Fix it in `zoom.us/account/user`, or change their email on one side so they match.

**Meetings are created but nobody can join** — check the meeting settings on your Zoom
account for a waiting room or authentication requirement that would block an external guest.

**It falls back to a personal link and you do not know why** — Penny will say which one she
used. If she says personal link while the secrets are set, the Zoom call failed and the
reason is in the edge function logs.
