interface SwarmTextProps {
  children: string;
  id: string;
  after?: string;
  align?: boolean;
  className?: string;
}

const latinWord = /((?:[\p{Script=Latin}\p{Number}_]\p{Mark}*)+(?:[-’'](?:[\p{Script=Latin}\p{Number}_]\p{Mark}*)+)*)/u;
const segmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('zh', { granularity: 'grapheme' })
  : null;

function renderGlyphs(text: string, partIndex: number) {
  const glyphs = segmenter
    ? Array.from(segmenter.segment(text), ({ segment }) => segment)
    : Array.from(text);

  return glyphs.map((glyph, index) => /^\s+$/u.test(glyph)
    ? glyph
    : <span key={`${partIndex}-${index}`} data-swarm-glyph="">{glyph}</span>);
}

export function SwarmText({ children, id, after, align = false, className }: SwarmTextProps) {
  return (
    <span className={className}>
      <span className="sr-only">{children}</span>
      <span
        aria-hidden="true"
        className="whitespace-pre-wrap"
        data-swarm-id={id}
        data-swarm-kind={align ? 'align' : 'text'}
        data-swarm-after={after}
      >
        {children.split(latinWord).map((part, index) => index % 2 === 1
          ? <span key={index} className="whitespace-nowrap">{renderGlyphs(part, index)}</span>
          : renderGlyphs(part, index))}
      </span>
    </span>
  );
}
