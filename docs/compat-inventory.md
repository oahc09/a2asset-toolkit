# M0-01 compatibility inventory

| Source | Revision | Detail |
|---|---|---|
| game-design | 637e383783123d97bc05b235f1a5be125a9faba1 | [real schemas, six fixtures and pure mapping](game-design-inventory.md) |
| cocosairjs | 2886aa3a3d740fd53248f2ed517d090faa5f5d08 | [actual exports, loading/lifecycle and limitations](cocosair-inventory.md) |

Both were read-only checkouts. No changes or patches to either upstream repo.
Current GameSpec has no asset slot protocol; an A2Asset-owned bridge expresses a
frozen display mapping without rewriting rules. Unsupported archetypes/extensions
fail explicitly. The actual upstream validator accepted six copied fixtures and
rejected damaged action spaces in integration tests.

Current real engine chain succeeds: manifest binding → verified local PNG bytes →
ImageAsset → Texture2D → createAirTextureSprite → framebuffer pixels → owned
resource disposal. Remaining font/audio/animation/atlas behavior is explicitly
unverified, not guessed from export names. The runtime slice is Preview only.

See [frozen input constraints](m0-input-contracts.md),
[semantic rule matrix](semantic-rule-matrix.md), and
[independent review](review-m0-contracts.md). Review found four false-positive
paths; regression tests now enforce FAIL/BLOCKED rather than claim certification.
