---
name: regression-guard
description: Decide what a failing existing test means - a regression to report, an intended behaviour change listed in the issue's "Impact on existing features", a broken locator, or flakiness - and what you may change. Use whenever an existing end-to-end or unit test fails during testing or development.
---

# Regression guard

The regression suite is the product's memory: every test encodes behaviour someone approved.
When an existing test fails, find out why before touching it.

## Classify the failure
| Situation | What it is | What you do |
|---|---|---|
| The behaviour the test asserts is listed under **"Impact on existing features → changes"** in the issue | intended change | update the assertion to the new requirement, and rename the test to the new AC (`AC4 (#n): …`); note it in the report |
| The test asserts behaviour that must keep working, and the app no longer does it | **regression** | keep the test failing; it is a finding (severity high); never edit it |
| The behaviour is unchanged but the element moved or was renamed (role or name changed with no behaviour change) | broken locator | fix the locator only; the assertion stays identical; note it |
| It passes on rerun (`--repeat-each=3` mixed results) | flaky | report it with the failure rate; don't change the app; fix the test only if the cause is the test (missing await, time dependency) |
| The test itself was wrong (asserted something no spec or AC says) | bad test | report it; change it only with a citation of the spec decision it now follows |

## Never
- delete or skip a failing test, loosen an assertion, add retries or longer timeouts to make it
  pass;
- update a visual baseline that changed unless the change is an intended one listed in the issue
  (then say so in the report);
- decide that a changed behaviour is fine because it "looks better": behaviour changes are
  approved in refinement, not in testing.

## Not listed but changed?
If the code changed behaviour that the issue's impact section does not mention, it is a
regression or a scope gap, even when the new behaviour seems reasonable. Report it under
"Regressions" and ask the reviewer in "Questions".
