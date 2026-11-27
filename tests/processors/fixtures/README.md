# Font decoder test fixture provenance

`dejavu-a2asset.woff2` is a traditionally subset/WOFF2-encoded DejaVu Sans test font,
not AI-generated artwork and not a Production-approved game asset.

- Source: current environment `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`.
- Upstream: https://dejavu-fonts.github.io/
- Original SHA256: `57f73e11f51999432bf7ab22ce55b6f945d5eca1bf824404cfa9ec2e3718c84e`.
- Full distribution license copied unchanged from
  `/usr/share/doc/fonts-dejavu-core/copyright` to `DejaVu-LICENSE.txt`.
- License permits reproduction/modification/distribution with notices; modified
  font names must not contain Bitstream or Vera. Retained family is DejaVu Sans.
- Transformation: fontTools 4.61.1, Brotli 1.2.0;
  `pyftsubset DejaVuSans.ttf --text=A2Asset --flavor=woff2 --output-file=dejavu-a2asset.woff2`.
- Derived SHA256: `a35d8983f6e35a00490b96322a70641d248323b71c79fdcc4405890654ff93fe`;
  size 3132 bytes. UTF characters intentionally limited for missing-glyph tests.
- Decoder test forces each glyph outline to decode; browser rendering remains NOT_RUN.
- No system font outside this explicitly licensed derived fixture is distributed.

The helper encoder required Brotli, installed only in a temporary test-generation
location. Consumers do not require Python/fontTools/Brotli to run the tests because
the derived fixture and license are included. System package version was not
available from dpkg-query; the precise source byte hash is authoritative.
