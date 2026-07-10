# UAP Files

A public archive of U.S. Government declassified UFO/UAP files — documents, images, and videos — browsable, searchable, and streamable in a short-form video feed.

## Language

### Archive

**Release**:
A batch of declassified files published together (e.g., "release-2").

**File**:
A single declassified artifact within a Release — a video, PDF document, or image.
_Avoid_: Item, asset, record

**Moment**:
A curated, pre-extracted segment of a video File (start/end time plus description), authored by the archive pipeline — not by users. Shown as markers in feed playback controls.
_Avoid_: Highlight, clip (a Clip is user-authored)

**Tag**:
Categorical metadata attached to a File (e.g., "sighting", "military").

**Agency**:
The government source of a File (e.g., DoD, CIA).

**Incident**:
The historical event a File documents — its date and location.

### Identity

**User**:
A signed-in account (email/password, magic-link, or Google) that owns Bookmarks, Clips, and Exports. **There are no anonymous users** — every mark requires signing in via the auth modal.
_Avoid_: Guest / anonymous user (removed — see ADR-0003), visitor (a visitor who hasn't signed in is not a User)

**Member**:
A User whose email is **verified** — the only kind that can Clip or Export. Magic-link and Google sign-ins arrive verified; an email/password sign-up must verify first. A signed-in but unverified User can still Bookmark.
_Avoid_: Account (the credential is not the identity), registered user

**Email verification vs validation** (distinct — don't conflate):
- **Verification** proves the User *owns* the address (the OTP / magic-link). It's what makes a Member.
- **Validation** proves the address is *worth sending to* — deliverable (not a typo'd/dead domain) and not disposable. It runs at sign-up *before* a User exists, as a gate on the email-bearing auth endpoints (see ADR-0004). It does not prove ownership and does not make a Member.

### Marking

**Bookmark**:
A user's mark on a whole File, of any type. Belongs to exactly one User and references exactly one File.
_Avoid_: Favorite, save (in the feed UI "Save" means download), like

**Clip**:
A user-defined time range within a video File, owned by the User who created it. **Creating a Clip requires a verified Member** — a Bookmark only needs a signed-in account, but a Clip needs a verified one. **A Clip's bounds are fixed once created** — there is no re-trimming; to change a range you make a new Clip. A Moment can be added as a Clip in one tap (its bounds are copied as the starting selection, adjustable in the editor before saving), but the resulting Clip is not linked to the Moment.
_Avoid_: Moment (curated, archive-authored), segment, highlight

**Library**:
A User's complete set of Bookmarks and Clips, each optionally carrying a free-text note. There is exactly one Library per User; every mark is in it, whether or not it is also in any Collection.
_Avoid_: Saved items, favorites

**Collection**:
A named set of marks within a User's Library. A Collection references marks rather than containing them: one mark may be in many Collections, an unfiled mark is fine, and deleting a Collection deletes only the grouping — its marks remain in the Library.
_Avoid_: Folder (implies containment), playlist, album

**Export**:
A user-requested compilation of marks into downloadable artifacts, produced asynchronously. The marks are chosen ad hoc or by picking a Collection; either way the Export snapshots them at request time and never changes afterward. An Export has a lifecycle (pending → processing → ready / failed) and, once ready, yields links to its artifacts — including each Clip as a real cut video file. (When and how a Clip becomes a rendered file is an implementation concern — see ADR-0002.)
_Avoid_: Download (downloading a single File is a different act), backup

### Plans & limits

**Plan**:
Which entitlement set a User has — **Free** or **Paid**. Orthogonal to identity tier (User → Member): a Plan only matters for someone who can already Clip, i.e. a Member. Free is the default; Paid is unlocked by an active subscription.

**Subscriber**:
A Member with an **active** paid subscription (the Paid Plan). Entitlement keys off subscription *status*, **never** off the amount paid — a $5 and a $50 Subscriber are identical in what they can do (ADR-0005). User-facing label is "Supporter."
_Avoid_: Paid user/customer (a Stripe Customer is the billing record, not the identity), premium member.

**Clip allowance**:
The number of Clips a User may **create** within a calendar month — a *flow* meter, not a stock cap. Creating a Clip spends one unit; deleting a Clip does **not** refund it. Re-clipping identical bounds (a content-dedup render hit, ADR-0002) still spends a unit — the user is metered on intent, not on compute saved. The allowance differs by plan (Free vs Paid).
_Avoid_: Clip limit/cap (ambiguous — the legacy `maxClipsPerUser: 50` was a lifetime *stock* cap on Clips owned; the allowance is per-month creation), quota.

## Flagged ambiguities

- **"Save" vs Bookmark**: The feed's action overlay uses "Save" to mean *download the file to the device*. Bookmarking is a different act (marking for later within the app). Never use "save" for bookmarking.
- **Moment vs Clip**: Moments are archive-curated; Clips are user-authored. A user "saving a moment" is creating a Clip whose bounds happen to come from a Moment.
- **Bookmark vs Clip gating**: both are marks and both require signing in (the auth modal — there are no anonymous marks). Bookmarking needs only a signed-in account; Clipping additionally needs a *verified* Member. Don't assume "a signed-in User can mark" means "can do both."

## Example dialogue

> **Dev**: A user taps the bookmark icon on a PDF in the browser — what gets created?
> **Expert**: A Bookmark — it points at the whole File. Clips only exist for videos, and only when the user picks a time range.
>
> **Dev**: And if they tap a Moment marker in the feed and hit "add"?
> **Expert**: That creates a Clip with the Moment's start and end copied in. If the user later drags the Clip's end point, the Moment is untouched — they're not linked.
>
> **Dev**: So can a user Bookmark a video *and* have three Clips on it?
> **Expert**: Yes. The Bookmark marks the File itself; the Clips each mark a portion. They're independent.
>
> **Dev**: If I put that Bookmark in my "Navy footage" Collection and then delete the Collection, is the Bookmark gone?
> **Expert**: No — the Collection only referenced it. The Bookmark is still in your Library, and still in any other Collection it was added to.
>
> **Dev**: And if I export "Navy footage" and add two more clips to it tomorrow?
> **Expert**: Yesterday's Export doesn't change — it snapshotted the Collection at request time. Export the Collection again if you want the new ones.
