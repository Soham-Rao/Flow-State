# Roles, Permissions, Overrides, and Admin Controls

This guide is for people who need to understand how FlowState decides who can see or change what. It is especially important for administrators, team leads, and anyone managing shared workspace structure.

## Why this matters

Permissions are not only a security feature. They are also a collaboration feature.

Good permission design helps:

- the right people see the right work
- sensitive actions stay limited
- shared spaces remain usable
- mistakes are reduced

Bad permission design creates the opposite:

- confusion
- accidental overexposure
- blocked work
- unnecessary admin overhead

## Basic idea: role first, override second

FlowState uses roles as the main way to define access. A role gives a person a starting set of abilities.

Examples of roles might include:

- admin
- manager
- member
- viewer

Then, more specific overrides can adjust access for narrower situations.

That means a person’s actual access may depend on:

- their global role
- board-specific rules
- channel-specific or feature-specific overrides

## Roles

A role is a named bundle of permissions.

Roles help because they avoid individually configuring every person for every action. Instead, you define patterns that make sense for groups of users.

A good role system:

- reflects real responsibilities
- stays understandable
- avoids creating ten nearly identical roles with confusing differences

## Permissions

Permissions are the actual allowed actions inside the system.

Examples include:

- view a board
- create or edit cards
- manage board settings
- send messages in certain spaces
- manage roles
- review bug reports

When a user says, “Why can’t I do this?”, the real answer is usually about permission resolution, not the screen itself.

## Overrides

Overrides are important because not every user with the same role should always have the exact same access everywhere.

An override lets the system say something like:

- this person normally cannot do X, but can do it in this one place
- this person normally can do Y, but not in this particular area

This is how FlowState can preserve intentionally shared resources without making everything universally open or universally locked down.

## Why overrides are powerful but risky

Overrides are useful because they create flexibility.

They are risky because too many exceptions make the system hard to reason about.

If every team space depends on many special-case overrides, people stop understanding what access rules really apply.

Good override habits:

- use them for real exceptions
- document why they exist
- review them periodically

## Admin controls

Administrators usually have the broadest controls. These may include:

- creating or editing roles
- assigning roles to users
- changing workspace-level settings
- reviewing internal bug reports
- managing permissions that other users cannot change

Admin access should be used carefully. Being allowed to do something does not always mean it should be done casually.

## The difference between visibility and edit power

Someone may be able to view a resource without being able to change it.

For example:

- a user may see a board but not edit board settings
- a user may read a conversation but not manage permissions around it
- a user may submit bug reports but not close them

When thinking about permission design, always separate:

- who can see
- who can act

## Common permission scenarios

### Scenario 1: Shared board, limited editing

A team may want many people to see a board but only a smaller group to manage its structure.

### Scenario 2: Admin-only operations

Features like role editing or bug inbox triage should usually stay in admin hands.

### Scenario 3: Specific exception for one team area

An override may allow a normally limited user to manage one specific board or workflow area.

## How to change permissions safely

Before changing a role or override, ask:

- what exact problem am I solving
- who will gain access
- who might lose access
- is this a role problem or a one-off exception
- will teammates understand the result

Then test the change mentally:

- if this person signs in right now, what will they newly see
- what new actions will they gain
- could this expose something unintended

## What to do when someone reports an access problem

When a user says “I can’t access this,” do not assume the system is broken immediately.

Check:

- are they in the correct workspace area
- does their role allow the action
- does an override change the expected result
- are they trying to edit rather than view
- did their session expire or permissions change recently

## Signs of a healthy permission model

A healthy access system usually feels like this:

- most users understand what they can do
- only a few exceptions require manual overrides
- admins can explain unusual cases
- sensitive actions are clearly limited
- shared collaboration still feels easy

## Signs the model needs cleanup

Watch for these warning signs:

- many one-off overrides nobody remembers
- frequent confusion about who can do what
- users seeing too much unrelated information
- teams blocked by over-restrictive defaults
- admins afraid to touch permissions because the model is too tangled

## If you need the exact permission-by-permission list

Use the dedicated reference page:

- [Complete permission reference](permission-reference.md)

That document lists every currently defined permission key and its plain-English meaning.

## Bug report permissions

The current bug inbox is a good example of scoped access:

- any signed-in user can submit a report
- users can review their own reports
- only admins can view the whole inbox and change statuses

That balance keeps reporting useful without making triage chaotic.

## Practical guidance for admins

- keep the number of roles reasonable
- use clear role names
- prefer stable role design over constant exceptions
- use overrides deliberately, not casually
- review high-impact permissions before and after changes

## What to read next

Continue with:

- [Settings index](../features/settings/index.md)
- [Complete permission reference](permission-reference.md)
- [Common workflows and end-to-end tutorials](../tutorials/common-workflows.md)
