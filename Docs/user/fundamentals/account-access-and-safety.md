# Account Access and Safety

This guide explains how to create an account, sign in, protect your account, and understand the most important safety rules as a FlowState user.

## 1. What the login and register pages are for

FlowState has two public entry pages:

- `Login`
- `Register`

Use `Register` if:

- you do not already have a FlowState account
- your team has told you to create your own account on the live site

Use `Login` if:

- your account already exists
- you are returning to continue your work

## 2. Creating an account

On the register page, you will usually enter:

- your name
- your email address
- your password

You must also confirm that you accept:

- the Privacy Policy
- the Terms of Use

Important:

- you cannot create an account unless you accept both legal documents
- this is intentional and not an error

## 3. Why legal acceptance is required

Because FlowState is a publicly hosted application, users need clear notice about:

- how the service is used
- what data may be stored
- what acceptable behavior is
- what the service promises and does not promise

Even if the app is mainly for an internal team, this is still important once outside users or external collaborators may access it.

## 4. What makes a good password

A good password should be:

- unique to FlowState
- reasonably long
- difficult for another person to guess
- not based on your birthday, role, or obvious personal information

Good habits:

- use a password manager if possible
- avoid reusing a password from email, banking, GitHub, or school/work systems
- prefer a long phrase or strong generated password over a short memorable password

Bad habits:

- sharing your password in chat
- storing it in screenshots
- telling teammates to log in as you
- using the same password everywhere

## 5. Signing in

To sign in:

1. open the login page
2. enter the email address tied to your account
3. enter your password
4. click the sign-in button

If successful, FlowState takes you into the protected app area.

## 6. What happens after login

After login:

- your browser stores session/auth information needed to keep you signed in
- the app loads your profile, role, and accessible data
- the protected routes such as dashboard, boards, threads, and settings become available

You do not normally need to manage this manually.

## 7. Session expiry

Sometimes a session can expire. This may happen if:

- you were inactive for a while
- the server restarted
- your auth state became invalid
- your login token is no longer accepted

When this happens, FlowState should show a friendlier message rather than exposing a technical error. The normal next step is simply:

- sign in again

## 8. If you cannot log in

Check the following first:

- are you using the correct email address?
- did you accidentally register with a different email?
- is Caps Lock on?
- did your browser auto-fill the wrong password?

If you still cannot log in:

- try again carefully
- refresh the page
- ask your admin whether your account exists and is using the email you expect

## 9. Password reset status

FlowState includes backend support for password-reset workflows, but real email delivery depends on future SMTP setup. That means:

- the product architecture expects password reset to exist
- but live recovery may still depend on later infrastructure work

For now, if your production environment does not yet support password reset emails:

- contact the admin or maintainer directly
- do not assume the reset email is live unless your team has explicitly told you it is

## 10. First-account rule in a fresh environment

In a brand-new FlowState deployment, the first successfully created account becomes the first admin.

This matters because:

- that account gets the broadest control
- the wrong person should not accidentally take the first-admin slot

If your team has a designated first admin:

- wait for that person to register first
- do not “just test signup” on the live site unless it is intentional

## 11. Email address expectations

Your email address in FlowState is important because it is used for:

- identifying your account
- future mail-based features like password reset or support workflows
- distinguishing users when usernames or display names are still incomplete

Use an email you actually control and can keep using.

## 12. Username, display name, and full name

These are different concepts:

- full name: your actual name or formal name
- username: your short unique handle, often used with `@mentions`
- display name: what people visibly see in the UI

Example:

- full name: `Aarav Sharma`
- username: `aarav`
- display name: `Aarav`

If you want teammates to mention you easily, set your username clearly in profile settings.

## 13. Privacy and what your browser stores

FlowState may use browser storage for essential app behavior such as:

- keeping you signed in
- storing local UI preferences
- saving some personal local-only settings such as focus timer history

This does not mean the browser is the main source of truth for all product data. Most shared data still lives on the server.

## 14. Safety rules for shared workspaces

Because FlowState is collaborative:

- do not share accounts
- do not impersonate teammates
- do not bypass permissions
- do not store sensitive information casually in public/shared channels if your team would not want others to see it

The app has permissions, but good judgment still matters.

## 15. If something looks suspicious

Examples:

- a permission error appears where you expected access
- content appears editable when it should not be
- another user seems to have access they should not have

What to do:

1. stop and avoid making risky changes
2. take note of what page you were on and what you clicked
3. report it through `Settings -> Advanced -> Report a bug`
4. if urgent, tell the admin directly

## 16. Quick checklist

Before you start serious work in FlowState, make sure:

- you can log in successfully
- your profile is correct
- your username is set if your team uses mentions
- you understand which areas are shared and which are permission-controlled
- you know where to report problems

After this guide, the best next read is [Navigation and interface basics](navigation-and-interface.md).
