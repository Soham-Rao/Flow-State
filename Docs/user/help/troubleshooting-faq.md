# Troubleshooting and Frequently Asked Questions

This guide is for the moments when something is confusing, unavailable, or not behaving how you expected. The goal is to help you distinguish between:

- a normal product rule
- a permission restriction
- a temporary network or server issue
- a genuine bug worth reporting

## First question: what kind of problem is this

Before trying random fixes, identify the category.

Common categories:

- I cannot sign in
- I can sign in, but I cannot access something
- I can see something, but I cannot edit it
- a page failed to load
- a message or board action failed
- the app looks different than expected after a deploy or refresh

## Sign-in problems

### I cannot sign in

Check:

- did you type the correct email or username
- is your password correct
- is Caps Lock on
- are you on the correct environment and URL

If the login form rejects your credentials, do not keep retrying endlessly. Slow down and verify what you are entering.

### I cannot register

Possible reasons:

- you left a required field empty
- the legal consent checkbox was not selected
- a validation rule rejected the form
- the server is temporarily unavailable

If the form explains the exact field problem, fix that field first before assuming the whole site is broken.

## Permission and access problems

### I can see a board but cannot change it

This usually means:

- you have view access but not edit access
- your role or an override allows reading but not managing

### I cannot find a board or channel someone mentioned

Possible reasons:

- you do not have access
- it was archived
- it was renamed
- the other person assumed visibility that you do not actually have

### I got a permission dialog

This usually means the system intentionally blocked the action. It does not automatically mean the app is broken.

Check:

- are you signed into the correct account
- are you in the correct workspace context
- should your role really allow the action

## Page loading errors

### The page says it could not load

Possible reasons:

- temporary network loss
- session expired
- server error
- maintenance or deploy window

Try:

- refreshing once
- confirming your internet connection
- signing in again if the app suggests session expiry

If the app repeatedly shows a structured error card or banner, read the message instead of dismissing it automatically.

## Message and board action failures

### My message did not send

Possible reasons:

- your session expired
- the network dropped
- the conversation is no longer available to you
- validation rejected the message

### My board change did not save

Possible reasons:

- permission issue
- temporary connectivity issue
- conflicting or invalid edit

If you see a clear validation message, fix the content first. If you see a permission warning, confirm your access.

## Maintenance and deploy moments

During maintenance or deployment, the app may temporarily show:

- a maintenance page
- a retryable error message
- a short-lived reload or reconnect behavior

This is normal if the system is being updated. Wait a moment and try again rather than clicking aggressively.

## When to report a bug

Report a bug when:

- the same issue happens repeatedly
- the app behaves inconsistently without explanation
- the error does not look like a normal permission or validation rule
- the UI contradicts itself

Before reporting, gather:

- the page you were on
- what you clicked
- what happened
- what you expected instead

## Frequently asked questions

### Is FlowState installed on my computer like a normal app?

Usually no. You access it through a web browser.

### Why do I sometimes see different things than another user?

Because roles and overrides can change what each person is allowed to see or do.

### Should I delete or archive old work?

If you are unsure, archive first.

### Why is the dashboard different from chat or boards?

Because the dashboard is for orientation and prioritization, while boards and messaging are where detailed work and discussion happen.

### Why does the app ask me to sign in again sometimes?

Your session may have expired for security reasons.

### What if I am not sure whether something is a bug or just a rule?

Use the bug report form anyway, but describe what made it feel wrong. A vague report is still better than silent confusion if the issue is real.

## A simple recovery checklist

If something feels wrong:

1. stop and read the current page title
2. reread the message shown by the app
3. decide whether it looks like validation, permission, session expiry, or server trouble
4. refresh once if appropriate
5. report the issue through Advanced settings if it still seems wrong

## Keep this mindset

Not every denial is a bug.

Not every failure is your fault.

The goal is to identify the type of problem calmly so the next step makes sense.
