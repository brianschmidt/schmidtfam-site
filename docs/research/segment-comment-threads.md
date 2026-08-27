# Carpool segment comment threads

## Key findings

- The useful spreadsheet behavior maps cleanly to one chronological thread per carpool segment, not one thread per event. `To event` and `Home` can therefore carry different attendance or coordination notes.
- A flat chronological thread preserves the speed of a note column while supporting multiple parents. Nested replies would add ambiguity and interface weight without adding useful context because the segment already scopes the conversation.
- Comments use the existing team web credential for access and a separate per-comment edit token for ownership. Only the creating browser receives that raw edit token; the database stores its SHA-256 hash.
- Soft deletion keeps audit history while removing the comment from normal reads. Active reads use a partial `(carpool_slot_id, created_at, id)` index, and a full foreign-key index covers relationship maintenance.
- The frontend escapes all parent-provided names and comment bodies before rendering. Newlines are preserved for readability without accepting HTML.

## Pricing and limitations

- The feature uses the existing Supabase database and Edge Functions, so it adds no separate service or subscription.
- Every comment is readable by anyone who possesses the team magic link. The composer explicitly states this; comments should not contain sensitive personal information beyond ordinary team coordination.
- Ownership remains browser-specific in v1. A parent cannot edit a comment from a different browser without a future authenticated recovery flow.
- Comment threads are not realtime subscriptions. The board refreshes after the current parent writes, and other parents see changes when they reload or reopen the page.
- Comments are limited to 500 characters and parent names to 60 characters.

## Code snippets for integration

The protected schedule response nests comments under each segment:

```json
{
  "id": "57",
  "direction": "to_event",
  "label": "To event",
  "comments": [
    {
      "id": "12",
      "authorName": "Brian",
      "body": "Lara will miss this practice.",
      "createdAt": "2026-08-27T22:00:00Z",
      "updatedAt": "2026-08-27T22:00:00Z"
    }
  ]
}
```

Creating a comment uses the existing protected write endpoint:

```js
await runTeamAction({
  action: "comment.create",
  slotId,
  authorName,
  body
});
```

The active-thread query is backed by a partial chronological index:

```sql
create index slot_comments_active_slot_created_idx
  on private.slot_comments (carpool_slot_id, created_at, id)
  where deleted_at is null;
```

## Next steps

1. Let parents try the flat thread model before adding replies, notifications, or reactions.
2. If missed-practice notes become common, consider an optional structured attendance status alongside freeform comments.
3. When Google authentication is added, associate comments with user IDs and offer cross-device ownership and recovery.
4. Consider lightweight polling only if parents need comments to appear without a reload; avoid Realtime complexity until the need is observed.
