# Accounts and scope

All seeded accounts use `password123`.

| Email | Name | Role | District |
| --- | --- | --- | --- |
| clerk.nadi@oriel.test | Nadi Ross | Clerk | NORTH |
| clerk.suri@oriel.test | Suri Hale | Clerk | SOUTH |
| review.arden@oriel.test | Arden Vale | Plans reviewer | NORTH |
| review.bela@oriel.test | Bela Moran | Plans reviewer | SOUTH |
| zoning.kael@oriel.test | Kael Drew | Zoning officer | NORTH |
| zoning.iren@oriel.test | Iren Cole | Zoning officer | SOUTH |
| inspector.mira@oriel.test | Mira Chen | Field inspector | NORTH |
| inspector.ren@oriel.test | Ren Moss | Field inspector | SOUTH |
| supervisor.oz@oriel.test | Oz Hart | Permit supervisor | NORTH |
| supervisor.lei@oriel.test | Lei Pratt | Permit supervisor | SOUTH |
| controller.vik@oriel.test | Vik Sato | Finance controller | ALL |
| admin.elsa@oriel.test | Elsa Rowan | Administrator | ALL |

Authentication, account status, identity, role, district, and ownership are
server-side facts. Wrong passwords, missing sessions, revoked sessions, and
suspended accounts are denied. Signing out revokes the active session.

Operational users never list, read, or change permits outside their district.
A clerk sees only permits created by that clerk; a reviewer or inspector sees
only records assigned to them; zoning officers and supervisors see their whole
district. Finance and administrators have citywide visibility, but Finance
must not receive restricted plans-review notes. Each permitted list must have
real positive content, not become an empty screen used to fake isolation.
