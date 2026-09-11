# Navigation verifier change

Only `keyboard_navigation_exact_coordinates` changed; its weight is still 1.0.

## Before

Feature metadata: feature=cursor_navigation; sub_feature=exact_logical_coordinates; kind=graded; depends_on=render_and_constraints. This criterion is all-or-nothing. Use the real mouse to place the caret in the first logical line and press Home to establish its start. Observe whether the displayed line and column counters each start at zero or one, and use those same bases consistently throughout. The line ordinals below identify document content, not mandatory display labels; character offsets count characters before the caret, starting at zero. Use real key presses only for the following sequence. Four ArrowDown presses must reach the fifth logical line at offset 0. End must reach the end of Timeline at offset 8. ArrowDown must reach the sixth logical line at offset 8; Home must reach its offset 0; ArrowLeft must cross the newline to the end of Timeline; ArrowRight must return to the start of the sixth logical line. Press End on the sixth logical line and require its actual end, then ArrowUp must clamp to the end of the shorter Timeline line and ArrowDown must restore the intended position at the end of the sixth logical line. Finally use the real mouse to place the caret inside the final logical line, press End, and require the caret after its complete tail-sentinel text. At every checkpoint, require the visible caret and displayed cursor position, normalized using the established bases, to agree with the exact content-derived position. Record the observed labels and normalized positions. A consistent zero-based or one-based display is acceptable; incorrect movement, inconsistent counters, document changes, or loss of editor focus fails.

## After

Feature metadata: feature=cursor_navigation; sub_feature=exact_logical_coordinates; kind=graded; depends_on=render_and_constraints. This criterion is all-or-nothing. Use the real mouse to place the caret in the first logical line and press Home to establish its start. Observe whether the displayed line and column counters each start at zero or one, and use those same bases consistently throughout. The line ordinals below identify document content, not mandatory display labels; character offsets count characters before the caret, starting at zero. Use real key presses only for the following sequence. Four ArrowDown presses must reach the fifth logical line at offset 0. End must reach the end of Timeline at offset 8. ArrowDown must reach the sixth logical line at offset 8; Home must reach its offset 0; ArrowLeft must cross the newline to the end of Timeline; ArrowRight must return to the start of the sixth logical line. Press End on the sixth logical line and require its actual end, then ArrowUp must clamp to the end of the shorter Timeline line and ArrowDown must restore the intended position at the end of the sixth logical line. Finally use the real mouse to place the caret inside the final logical line, press End, and require the caret after its complete tail-sentinel text. At every checkpoint, require the visible caret and displayed cursor position, normalized using the established bases, to agree with the exact content-derived position. Record the observed labels and normalized positions. A consistent zero-based or one-based display is acceptable; incorrect movement, inconsistent counters, document changes, or loss of editor focus fails.

During the first-line, fifth/sixth-line and final-line observations above,
also require visible document line numbers associated with the corresponding
rendered logical lines. Check that their labels identify those lines correctly
using a consistent zero-based or one-based line-number convention, including
after scrolling to the final line. Record the labels together with the text
they identify. A cursor-position status readout alone does not satisfy the
document line-number requirement. Do not require a particular gutter element,
placement or all offscreen lines to exist in the DOM; virtualized numbering is
acceptable when the visible labels identify the correct document lines.
Missing or incorrectly associated line numbers fail this criterion.
