# Cards, Checklists, Labels, Files, and Retention

Once you understand that a board is made of lists and cards, the next step is learning how to work inside a card carefully and effectively. This guide covers the day-to-day details that turn a board from a simple visual list into a real working system.

## What a card is really for

A card is the smallest major work object on a board. In many teams, the card is the place where the actual task lives.

A good card answers questions like:

- what needs to be done
- why it matters
- who owns it
- when it is due
- what progress has already happened
- what files or links are relevant

If a card title is vague and the details are empty, the card becomes hard for everyone else to understand later.

## What you can usually do inside a card

Depending on your permissions, a card may let you:

- rename the card
- edit the description
- assign people
- add labels or tags
- set or clear a due date
- add comments
- upload or attach files
- build a checklist
- archive the card
- delete the card

Some teams use cards very lightly. Others use them as the main record of project progress. FlowState supports both approaches, but consistency matters more than complexity.

When you create a new card from a board list, FlowState now requires three pieces of information before it will save the card:

- a card title
- a due date
- at least one assignee

This keeps new work accountable from the moment it enters a list.

## Writing better card titles

A card title should be short enough to scan and specific enough to understand without opening the card every time.

Better titles:

- `Draft onboarding email for new contractors`
- `Fix sidebar overlap on small laptop screens`
- `Review April budget spreadsheet`

Weaker titles:

- `Email`
- `Bug`
- `Stuff to do`

If a teammate cannot understand the basic purpose of the card from the title alone, improve the title.

## Writing the description

The description is where you provide context. Use it for information that would clutter the title but is still important.

Good description content:

- background context
- expected outcome
- links to related documents
- step-by-step instructions
- notes about blockers or dependencies

Avoid turning the description into a chaotic dump of unrelated updates. If the details are about progress over time, comments may be a better place.

## Assigning people

Assignments answer the question: who is responsible for moving this forward?

Use assignments when:

- one person owns the task
- several people are jointly responsible
- teammates need clear visibility into ownership

Be careful with over-assignment. If every card is assigned to many people, the assignments stop being useful because nobody can quickly tell who is actually accountable.

Good assignment habits:

- assign the person doing the work
- use comments to coordinate supporting help
- remove outdated assignees when ownership changes

## Labels and tags

Labels help you classify work beyond the list it sits in.

Lists often answer:

- where is this in the workflow

Labels often answer:

- what kind of work is this
- how urgent is it
- which area does it belong to

Examples of useful labels:

- `Urgent`
- `Design`
- `Backend`
- `Client`
- `Blocked`
- `Needs Review`

Labels work best when your team uses a limited, shared vocabulary. If every person invents their own label style, labels become noisy instead of helpful.

## Due dates

Due dates answer the question: when does this need attention?

A due date can be useful for:

- deadlines
- reminders
- review dates
- follow-up checkpoints

Be honest with due dates. If every card gets an unrealistic due date, the board stops showing meaningful urgency.

FlowState shows floating due-date reminders on both the home dashboard and the board page. Assigned users are reminded the day before and again throughout the due day. People with manager due-reminder permission, including admins by default, can also receive lighter reminders for cards assigned to others so they can check in without being interrupted as often as the assignee.

## Comments

Comments are best for communication that belongs to the card itself.

Good uses for card comments:

- status updates
- questions about the task
- clarification from teammates
- references to decisions that affected the work

Try not to put every update into the description. A description is usually for stable context. Comments are usually for ongoing discussion and progress.

## Checklists

Checklists are useful when a single card contains several substeps.

Examples:

- publishing a release
- onboarding a new team member
- preparing an event
- reviewing a set of assets

A checklist helps because it breaks one large task into smaller visible steps. This is especially helpful when a card feels too vague or overwhelming.

Use a checklist when:

- the work has multiple clear substeps
- you want visible progress inside the card
- the substeps are related enough to remain one card

Do not force huge unrelated projects into one card just because you can add a checklist. If the checklist becomes a mini project plan by itself, the work may deserve multiple cards instead.

## Files and attachments

Some cards may let you attach files or link supporting materials. Use this carefully.

Good attachment examples:

- a mockup for a design task
- a spreadsheet relevant to the work
- a screenshot demonstrating a bug
- a file teammates need in order to complete the task

Before attaching a file, ask:

- does this belong on this card
- is the file current
- does the file contain sensitive information
- would a link be better than a duplicate upload

## Mentions inside card-related writing

If card comments or descriptions support mentions, use them thoughtfully.

Mentions are best when:

- you need a specific person’s attention
- you are handing off work
- you need review or approval

Mentions are less helpful when:

- you mention many people without a clear ask
- the update is not relevant to all of them
- the card itself already clearly belongs to the assignee and no action is needed

## Editing with care

Before changing a card, check whether you are changing:

- the title
- the stage of work
- the owner
- the deadline
- the classification
- the conversation history

Each kind of change has a different meaning. A careful edit keeps the card trustworthy.

## Archiving a card

Archiving is usually the safest way to remove a card from active view without immediately destroying the record.

Archive a card when:

- the work is complete and no longer needs to stay visible
- the task is no longer relevant
- the card was created too early and should be set aside

Archiving is often better than deleting because it preserves the idea that the work existed and may still matter later.

## Deleting a card

Delete only when you are sure the card should no longer exist at all.

Examples where deletion may make sense:

- accidental duplicate cards
- test data created by mistake
- a clearly wrong card with no useful history

If a card contains discussion, assignments, or historical value, archiving is often a safer choice.

## Archived lists and archived cards

If you cannot find something, it may not be gone. It may be archived.

That is why it helps to remember:

- active view shows current work
- archived view shows intentionally hidden inactive work

If a teammate says, “I cannot see the old card anymore,” the next question should often be:

- was it archived
- was it moved
- or was it actually deleted

## Common mistakes people make

### Using cards with no context

If a card only says `Fix this` or `Do later`, nobody will know what it means a week later.

### Using labels instead of good titles

Labels help classification, but they cannot rescue a vague card title.

### Leaving stale assignments

An old assignee can make everyone assume the wrong person is responsible.

### Deleting too quickly

If you are unsure, archive first.

### Putting everything in one giant card

Very large cards become hard to scan, hard to update, and hard to own.

## A simple good-card checklist

Before you leave a card, ask:

- does the title clearly say what the work is
- is the description useful
- is the owner clear
- is the due date realistic
- do the labels help classification
- are comments being used for conversation
- should this stay active, move, archive, or split

## When to split one card into several cards

Split a card if:

- several people own distinct parts
- the task contains unrelated outputs
- the checklist is becoming a full project plan
- the work may finish in separate stages

Keeping work split sensibly makes boards easier to trust.

## What to read next

Continue with:

- [Boards overview](boards-overview.md) if you need a broader mental model
- [DMs, channels, replies, mentions, and media](../threads/dms-channels-and-messaging.md) if you need the communication side of FlowState
