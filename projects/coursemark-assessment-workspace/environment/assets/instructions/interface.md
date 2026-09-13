# Interface and accessibility

Provide distinct Courses, Assessments, Attempts, Gradebook, and Audit views with
clear current navigation marked aria-current="page", navigation/main landmarks,
useful headings, status labels, and understandable
empty states. Keep current identity, role, fixed reference time, course
revision, synchronization feedback, and sign-out discoverable.

Make assessment creation, question authoring, attempt answers, submission,
rubric grading, release, filters, and detail dialogs usable by keyboard and
pointer. Label every form control, preserve visible focus, announce errors and
successful synchronization, disable a pending action, and keep dialogs
closable without trapping the workspace. Keep focus within an open modal and
return it to a usable workspace control on close. Demo sign-in help includes
all four accounts and their password. Invalid forms retain their entered
values and explain the error without a saved revision change.

Use legible type, contrast, spacing, non-color status cues, and a coherent
education-product hierarchy. At 375 pixels wide, sign-in and all five views
must avoid horizontal page scrolling, clipped actions, and overlapping text.
Keep primary input/button touch targets at least 44 pixels high and honor `prefers-reduced-motion` while leaving
state changes understandable.
