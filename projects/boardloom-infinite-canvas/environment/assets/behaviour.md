# How the canvas should behave

Draw rectangles, diamonds, ellipses, arrows, lines, freehand pencil, text, sticky
notes and images. Select things, pan around, erase.

Everything lands on a 10px grid — moves and new shapes both — because diagrams
drawn by six people otherwise look like a ransom note. The pencil is the
exception: it records the hand as it moved, unsnapped, with round ends. A pencil
stroke forced onto the grid comes out as a staircase and is not what anyone drew.

Lines and arrows stay straight. An arrow ends in a filled triangular head so you
can tell at a glance which way it points, and that head keeps its own colour when
someone flips the theme — an arrow that goes invisible in dark mode is a bug we
have actually hit.

Connectors attach to objects, not to coordinates. Drag the box and the connector
end comes with it to the box's new edge. If it stays behind pointing at empty
canvas, the diagram is lying.

Layers matter once a board gets busy: hide something you are not working on, and
bring something to the front. Both survive a reload.

Components are the part that saves us the most time. Turn a shape into a master,
place instances of it, and changing the master's fill changes every instance. An
instance can override its own text without breaking that link, and resetting the
override puts the master's text back.

Groups move together — moving one member moves all of them by the same amount.

Duplicating a shape gives you one copy of it, same type, same size, same style,
offset so you can see it. One copy, not two, and nothing else changes.

All of it lives on the server: geometry, connectors, groups, locks, components,
saved versions, undo and redo. Close the tab, come back, and it is all still
there. If something fails, nothing changes — half-applied is worse than refused.
