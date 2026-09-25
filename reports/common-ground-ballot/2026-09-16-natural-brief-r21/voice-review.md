# Independent voice review

Reviewed the rewritten `projects/common-ground-ballot/instruction.md` against the two reported voice findings and the saved previous brief. This is an editorial review, not a platform QC result. No task file, code or verifier was changed by this review.

The rewrite substantially addresses both findings. It opens with a plausible request from the association, introduces the people before technical rules, explains the practical reasons for persistence, privacy, stale changes and interrupted work, and places deployment details in a short hosting note near the end. The old specification headings, account table, runtime checklist and opening build recipe are gone. The remaining login list is useful reference material, not a sequence of implementation commands. Direct requests such as keeping an attempt before sending it are appropriate product requirements in their surrounding context.

## Highest-value correction

The sentence “A successful vote should confirm participation without sending the choices back in the response or showing them in the confirmation” adds “or showing them in the confirmation” to the previous request. That phrase could be read as forbidding a normal review of selected choices before final submission, or as a new independent UI restriction. The previous requirement concerned the successful vote response. Remove that final phrase, or explicitly limit it to the post-save acknowledgment. Removing it best preserves the existing scope.

## Minor clarity improvement

The hosting note says to include the supplied seed at `/app/common_ground_seed.json`, then “use `SEED_PATH` instead if it's provided.” Its intended runtime meaning is understandable, but “At startup, read `SEED_PATH` if we've provided it” would distinguish the optional runtime path from the requirement to include the embedded seed. The embedded seed should remain part of the delivered app either way.

## Remaining voice risk

The whole-number/coercion paragraph and the operation-identifier paragraphs remain technically dense. They now sit inside concrete explanations of open tabs and lost responses, so they no longer read as isolated grading instructions. Their precision is useful and should not be weakened merely to sound casual. “And yes, we'll have two tabs open” is slightly performative; “We also keep two tabs open” would be more neutral, but this is optional.

No further high-value voice change is apparent. The brief is still long because it preserves a substantial product contract. Length alone is not evidence that it is a formal specification, and platform acceptance cannot be guaranteed by this local review.

## Final disposition

Re-read the final brief after the author addressed the observations above. Its vote-confirmation wording now explicitly concerns the acknowledgment after an accepted submission. This matches the existing `private_final_vote_confirmation` criterion, whose description already excludes submitted choices from the success response and post-submit confirmation; it does not restrict the preceding selection/review interface. The seed paragraph now requires the embedded copy and separately describes `SEED_PATH` as a startup override. The two-tab introduction is now the neutral “We also keep two tabs open.”

No remaining scope or voice concern was identified in this final editorial review. No code, verifier, runtime or platform-QC claim follows from that conclusion.

Reviewed final `instruction.md` SHA-256: `c48fc3206f078a395ee728e2bdceda6711fff01f1115e8da4ab68b3820f4b04d`.
