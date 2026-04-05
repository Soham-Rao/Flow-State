# Navigation and Interface Basics

This guide explains how the FlowState interface is laid out, what common visual elements mean, and what usually happens when you hover, click, type, or open menus.

## 1. The big picture

Once you are signed in, FlowState is divided into a few main areas:

- a left navigation/sidebar
- a top bar/header
- the main content area for the page you are currently using

The sidebar is how you move between major product areas. The main content area changes based on where you go.

## 2. Main navigation items

The left sidebar includes the major destinations:

- `Dashboard`
- `Boards`
- `Focus`
- `Threads`
- `Settings`

What each generally means:

- `Dashboard` gives you a summary of your work and activity
- `Boards` is where you organize tasks and projects
- `Focus` is your personal focus timer area
- `Threads` is where direct messages and channels live
- `Settings` is where you manage profile, preferences, and advanced tools

## 3. The top bar

The top bar usually shows:

- your display name
- your current role badge
- visible online users or presence indicators
- your account menu

The account menu usually lets you:

- open profile
- open general settings
- log out

## 4. Visual badges and counters

You will often see small colored badges in FlowState. These are important because they act like quick summaries without forcing you to open every page.

Common examples:

- red badges can mean mentions or unread messaging activity
- blue badges can mean assignments
- amber badges can mean admin-facing open items such as bug reports

Do not treat every badge the same way. A badge usually belongs to the specific feature it is attached to.

## 5. Hover behavior

FlowState uses hover states to reduce clutter while still keeping useful information available.

Hovering may reveal:

- action buttons
- menus
- previews
- mention detail popups
- message action controls

Examples:

- a board mention badge may show a small preview
- a message may reveal reaction, reply, or edit controls only when you hover it
- a settings area may show more options once you focus a section

If you are looking for an action and do not see it immediately, try hovering carefully over the item itself.

## 6. Click behavior

In FlowState, different kinds of clicks do different things:

- clicking a navigation item changes the main page
- clicking a board tile opens that board
- clicking a card may open its full editing view
- clicking a DM or channel opens that conversation
- clicking a settings category opens that settings page

In many places, the click target is larger than just the text. That is intentional and helps make the interface easier to use.

## 7. Menus and confirmations

Some actions are intentionally protected behind:

- contextual menus
- confirmation dialogs

This is especially common for:

- delete actions
- archive actions
- leave-channel actions
- destructive admin actions

If FlowState asks you to confirm something, it usually means the action could have broader consequences.

## 8. Save states and autosave

Some parts of FlowState save automatically after you stop typing. This is called autosave.

You may see messages like:

- `Saving...`
- `Saved`
- `All changes saved`
- `Up to date`

This means the product is trying to reduce extra manual save clicks while still giving you feedback.

## 9. Page-level errors vs field-level errors

FlowState shows different kinds of errors in different places.

Field-level errors:

- these appear near one input or one form area
- example: a title is too short

Page-level errors:

- these affect a whole screen or major loading request
- example: the dashboard could not load

Permission errors:

- these usually indicate you are not allowed to do something
- they should appear as a clearer product message, not a technical stack trace

## 10. Dialogs, banners, and notices

Common interface feedback patterns include:

- modal dialogs for important confirmations or blocking issues
- banners or error cards for page-level failures
- inline notices for smaller warnings or success states

Examples:

- a modal may say you do not have permission to delete something
- an error card may say a page failed to load and offer a retry button
- a success notice may say a bug report was sent

## 11. Settings structure

Settings are split into:

- `Profile`
- `General`
- `Advanced`

Use them like this:

- `Profile` for identity details
- `General` for appearance, role-management related tools, and notification preferences
- `Advanced` for bug reporting and admin bug inbox review

## 12. How Threads uses state

Threads is a little different from some other pages because:

- it supports multiple conversation types
- it can keep some choices in the URL, such as whether you are viewing DMs or channels
- it may show sidebars, drawers, reply panels, and preview panels

This is normal. Threads is one of the most interactive parts of the app.

## 13. Maintenance behavior

During a safe production update, you may briefly see a maintenance page instead of the app. That is not a crash. It means the app is intentionally being updated.

Important:

- the maintenance page can auto-refresh
- already-open tabs may behave differently than a fresh page reload
- the goal is to avoid leaving users with raw server errors during deploys

## 14. Keyboard and focus basics

Even if you mostly use a mouse, some keyboard rules are helpful:

- `Escape` often closes dialogs or panels
- `Enter` may submit a form or save an inline editor
- moving focus between fields can trigger autosave or blur behavior in some areas

If you accidentally close something, look for the same item in the page again rather than assuming it disappeared permanently.

## 15. A safe way to explore the UI

If you are still learning:

1. start on the dashboard
2. open boards without deleting or archiving anything
3. open one board and inspect a card
4. open threads and compare DMs vs channels
5. open each settings page

This lets you understand the product before you make heavier changes.
