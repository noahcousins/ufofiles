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
An identity that owns Bookmarks, Clips, and Exports. Every User is either a Guest or a Member.

**Guest**:
A User created silently on a visitor's first mark, bound to one device/browser. Guests can mark but cannot Export.
_Avoid_: Anonymous user (implementation term), visitor (a visitor who has marked nothing is not a User)

**Member**:
A User with sign-in credentials, reachable across devices. Upgrading turns a Guest into a Member (or links the Guest's marks into an existing Member). Linking merges marks as a union: duplicate Bookmarks on the same File collapse; Clips collapse only when their bounds are identical. Collections transfer as-is (names need not be unique), and when a duplicate mark collapses, the surviving mark inherits its Collection memberships.
_Avoid_: Account (the credential is not the identity), registered user

### Marking

**Bookmark**:
A user's mark on a whole File, of any type. Belongs to exactly one User and references exactly one File.
_Avoid_: Favorite, save (in the feed UI "Save" means download), like

**Clip**:
A user-defined time range within a video File, owned by the User who created it. A Moment can be added as a Clip in one tap (its bounds are copied), but the Clip remains independently adjustable and is not linked to the Moment afterward.
_Avoid_: Moment (curated, archive-authored), segment, highlight

**Library**:
A User's complete set of Bookmarks and Clips, each optionally carrying a free-text note. There is exactly one Library per User; every mark is in it, whether or not it is also in any Collection.
_Avoid_: Saved items, favorites

**Collection**:
A named set of marks within a User's Library. A Collection references marks rather than containing them: one mark may be in many Collections, an unfiled mark is fine, and deleting a Collection deletes only the grouping — its marks remain in the Library.
_Avoid_: Folder (implies containment), playlist, album

**Export**:
A user-requested compilation of marks into downloadable artifacts, produced asynchronously. The marks are chosen ad hoc or by picking a Collection; either way the Export snapshots them at request time and never changes afterward. An Export has a lifecycle (pending → processing → ready / failed) and, once ready, yields links to its artifacts. Clips are rendered into real video files at export time; a Clip with unchanged bounds is rendered once and reused.
_Avoid_: Download (downloading a single File is a different act), backup

## Flagged ambiguities

- **"Save" vs Bookmark**: The feed's action overlay uses "Save" to mean *download the file to the device*. Bookmarking is a different act (marking for later within the app). Never use "save" for bookmarking.
- **Moment vs Clip**: Moments are archive-curated; Clips are user-authored. A user "saving a moment" is creating a Clip whose bounds happen to come from a Moment.

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
