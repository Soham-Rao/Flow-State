# Boards: The Big Picture

Boards are the part of FlowState that help your team organize work visually. If Threads are where conversations happen, Boards are where planned work lives in a more structured way. A board usually represents a shared area of work such as a team, a project, a department, a campaign, or a long-running responsibility.

This guide explains what a board is, what you are looking at when you open one, and how to think about boards before you start moving or editing anything.

## What a board is

A board is a shared workspace for organizing work into columns and cards.

Inside a board, you will usually see:

- a board title and board-level controls
- one or more lists, which act like columns
- cards inside those lists
- archived items that were intentionally removed from the active view
- comments, assignments, labels, due dates, and attachments tied to individual cards

You can think of the structure like this:

- workspace
- board
- list
- card
- card details such as comments, tasks, assignments, due dates, and files

That hierarchy matters because actions at one level do not always affect the others. For example:

- moving a card to another list does not delete the card
- archiving a list does not always mean the entire board is gone
- changing a board setting can affect everyone who can access that board

## Common real-life ways to use boards

Teams often use boards for:

- sprint planning
- editorial calendars
- bug triage
- hiring pipelines
- launch checklists
- client delivery tracking
- personal task management inside a shared workspace

One team may create a board called `Engineering Sprint`, while another creates `Content Pipeline`, and another creates `Operations`. The interface stays similar even when the purpose changes.

## What you see on the boards page

When you first open the main Boards page, you are usually looking at a board directory rather than a single board.

That page commonly helps you:

- see which boards exist
- open a board you already use
- spot archived or inactive work depending on your permissions
- create a new board if you are allowed to do so

If a board is visible to you, that means one of these is true:

- the board is meant to be shared and your role grants access
- a more specific permission override allows you in
- you are an administrator or have a role with broader board access

If a board does not appear, that does not necessarily mean it was deleted. It may simply be outside your permission scope.

## What you see when you open a board

Inside a board, the screen usually has four main areas:

1. the board header
2. the active lists
3. card details or dialogs when you open a card
4. optional panels for settings, archived items, or activity

### 1. Board header

The board header is where you usually find:

- the board name
- actions like rename, archive, or settings if you have permission
- visual indicators that help you confirm you are in the right place

This area is important because some actions affect the whole board. If you are unsure whether you are editing one card or the entire board, look at whether you are using a board header control or a card-level control.

### 2. Lists

Lists are the columns inside the board. A team might use lists such as:

- Backlog
- To Do
- In Progress
- Review
- Done

The names are flexible. Your team may use a different flow. What matters is that lists usually describe a stage or category.

Lists are good for:

- showing progress visually
- separating work by step or status
- making drag-and-drop planning easier

### 3. Cards

Cards are the actual units of work inside lists. A card might represent:

- a task
- a reminder
- a bug
- a deliverable
- a note for follow-up

Cards can be simple or detailed. Some are just titles. Others become rich planning objects with comments, labels, due dates, assignees, and files.

### 4. Supporting dialogs and panels

Depending on what you click, the board may open:

- a card detail modal
- a board settings panel
- an archived items panel
- confirmation dialogs before destructive actions

If a panel opens and the rest of the screen dims, you are probably working inside a modal or focused editing state. Read the panel title carefully before confirming anything.

## How people usually work inside a board

The most common board workflow looks like this:

1. create or find the correct board
2. create lists for stages or categories
3. add cards into the correct list
4. assign owners, dates, labels, and notes
5. move cards as work progresses
6. archive finished or no-longer-needed items instead of deleting everything immediately

That means a board is both:

- a planning surface
- a live status board

## Creating a board

If your role allows it, you may see a button or entry point for creating a board.

Before creating one, decide:

- who the board is for
- whether it is long-term or temporary
- what your lists should represent
- whether the board name will still make sense later

Good board names are specific and durable. Examples:

- `Q2 Product Launch`
- `Customer Support Improvements`
- `Design Requests`

Less helpful names:

- `Stuff`
- `Tasks`
- `New Board`

Specific names help your team find the correct board later.

## Renaming a board

Renaming a board is usually safe, but it can confuse people if done casually.

Rename a board when:

- the current name is inaccurate
- the project evolved and the board name no longer fits
- the name is too vague

Avoid renaming a board repeatedly unless everyone understands why. A board changing names too often makes it harder for teammates to build habits around where work lives.

## Archiving a board versus deleting work

Many people worry that removing something from view means permanent loss. In FlowState, archival and deletion are not the same idea.

Archiving generally means:

- the item is intentionally removed from normal active view
- it may still be recoverable or reviewable
- it is treated as inactive rather than current

Deletion generally means:

- you are attempting a more final destructive action
- recovery may be limited or impossible depending on the exact feature

When in doubt:

- archive first
- delete only when you are sure

## Moving cards between lists

One of the most common board actions is dragging a card from one list to another.

Moving a card usually means:

- the task has changed stage
- the owner or team wants to re-prioritize it
- the work was placed in the wrong column initially

Moving is not the same as editing the card contents. The card remains the same card unless you open it and change its fields.

## When a board feels too crowded

If a board becomes hard to read, the problem is usually one of these:

- too many lists
- lists with too many cards
- card titles that are too vague
- old finished work not archived
- several unrelated workflows forced into one board

Ways to improve a crowded board:

- archive stale cards and lists
- split unrelated work into multiple boards
- rename lists to reflect the actual workflow
- use labels and assignments more consistently
- keep card titles short but specific

## Permissions and board access

A board is not automatically open to everyone in every situation. Access depends on your role and any overrides defined by administrators.

That means:

- two people may see different sets of boards
- two people in the same board may have different editing powers
- one person may be able to manage board settings while another can only view or comment

If you cannot do something inside a board, it may be a permissions issue rather than a bug.

## Safe habits for beginners

If you are new to board-based tools, these habits will help:

- read the board name before editing
- read the list name before dragging a card
- open a card before making assumptions about what it contains
- archive instead of delete when uncertain
- avoid renaming shared structures casually
- ask before changing permissions or board settings

## What to read next

After this overview, continue with:

- [Cards, checklists, labels, files, and retention](cards-checklists-labels-and-files.md)

That guide goes deeper into the actual things you do inside cards and lists once you understand the board structure itself.
